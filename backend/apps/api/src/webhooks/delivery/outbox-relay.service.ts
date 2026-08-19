import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Queue } from 'bullmq';
import {
  type OutboxEvent,
  Prisma,
  PrismaService,
  WEBHOOK_QUEUE,
} from '@app/shared';
import { enqueueDeliveries, type Enqueueable } from './enqueue';
import { MAX_ATTEMPTS } from './webhook.constants';

type Tx = Prisma.TransactionClient;

// Small on purpose. Every row in a batch is held under a lock until the whole
// batch commits, so a big one keeps a transaction open longer for no gain
const BATCH_SIZE = 50;

@Injectable()
export class OutboxRelayService {
  private readonly logger = new Logger(OutboxRelayService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(WEBHOOK_QUEUE) private readonly queue: Queue,
  ) {}

  // Two ticks overlapping is fine and expected, see the claim query below. The
  // interval is the floor on how late a webhook can be, so it is short
  @Cron(CronExpression.EVERY_5_SECONDS)
  async relay(): Promise<void> {
    try {
      const claimed = await this.claimBatch();

      // Deliberately after the commit. Enqueuing inside the transaction would
      // hand out a job id for a row that a rollback then took away
      await enqueueDeliveries(this.queue, claimed);

      if (claimed.length > 0) {
        this.logger.log(`queued ${claimed.length} webhook deliveries`);
      }
    } catch (error) {
      // Swallowed. The rows are still unpublished and the next tick is 5
      // seconds away, so there is nothing here worth crashing the app over
      this.logger.error(`relay failed: ${String(error)}`);
    }
  }

  private async claimBatch(): Promise<Enqueueable[]> {
    return this.prisma.$transaction(async (tx) => {
      // SKIP LOCKED is what makes a second relay tick harmless: it walks past
      // any row the first one is already holding instead of queueing behind it.
      // Plain FOR UPDATE would block, then hand over rows that are by then
      // already published
      const events = await tx.$queryRaw<OutboxEvent[]>`
        SELECT * FROM outbox_event
        WHERE "publishedAt" IS NULL
        ORDER BY "createdAt"
        LIMIT ${BATCH_SIZE}
        FOR UPDATE SKIP LOCKED
      `;

      if (events.length === 0) {
        return [];
      }

      const claimed: Enqueueable[] = [];

      for (const event of events) {
        claimed.push(...(await this.fanOut(tx, event)));
      }

      // Last, so a crash anywhere above rolls the whole thing back and leaves
      // the rows unpublished. Marking first would lose the event instead
      await tx.outboxEvent.updateMany({
        where: { id: { in: events.map((event) => event.id) } },
        data: { publishedAt: new Date() },
      });

      return claimed;
    });
  }

  // One event becomes one delivery row per endpoint that wants it. A merchant
  // with no endpoints produces none, and the event is still marked published:
  // published means the relay is done with it, not that anyone was told
  private async fanOut(tx: Tx, event: OutboxEvent): Promise<Enqueueable[]> {
    const endpoints = await tx.webhookEndpoint.findMany({
      where: {
        merchantId: event.merchantId,
        mode: event.mode,
        disabledAt: null,
      },
      select: { id: true, events: true },
    });

    const wanted = endpoints.filter(
      (endpoint) =>
        endpoint.events.length === 0 ||
        endpoint.events.includes(event.eventType),
    );

    if (wanted.length === 0) {
      return [];
    }

    await tx.webhookDelivery.createMany({
      data: wanted.map((endpoint) => ({
        merchantId: event.merchantId,
        endpointId: endpoint.id,
        outboxEventId: event.id,
        mode: event.mode,
        eventType: event.eventType,
        payload: this.envelope(event),
        maxAttempts: MAX_ATTEMPTS,
        // Due immediately. The retry sweep reads this column, so a job that
        // never made it into Redis still has a time on it
        nextAttemptAt: new Date(),
      })),
      // The unique index on endpoint plus event is the referee. A relay that
      // dies after this insert and before the publish mark will run the whole
      // batch again, and this is what stops the second run duplicating it
      skipDuplicates: true,
    });

    // Read back rather than trusting the insert count, so rows that a previous
    // crashed run created get picked up and queued here too
    return tx.webhookDelivery.findMany({
      where: { outboxEventId: event.id },
      select: { id: true, updatedAt: true },
    });
  }

  // The exact object the merchant will receive. Frozen into the delivery row
  // now, because a retry has to send the same bytes it signed the first time
  private envelope(event: OutboxEvent): Prisma.InputJsonObject {
    return {
      id: event.id,
      type: event.eventType,
      createdAt: event.createdAt.toISOString(),
      data: event.payload,
    };
  }
}
