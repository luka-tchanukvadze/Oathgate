import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Queue } from 'bullmq';
import type { DomainEvent } from '@app/contracts';
import {
  type Enqueueable,
  enqueueDeliveries,
  EventPublisher,
  MAX_ATTEMPTS,
  type OutboxEvent,
  Prisma,
  PrismaService,
  WEBHOOK_QUEUE,
} from '@app/shared';

type Tx = Prisma.TransactionClient;

// Every row in a batch is locked until the whole batch commits
// A bigger batch just holds the transaction open longer
const BATCH_SIZE = 50;

// One batch, two outputs
// A merchant with no endpoint gives me no deliveries and still an event
interface Claimed {
  deliveries: Enqueueable[];
  events: DomainEvent[];
}

@Injectable()
export class OutboxRelayService {
  private readonly logger = new Logger(OutboxRelayService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly publisher: EventPublisher,
    @InjectQueue(WEBHOOK_QUEUE) private readonly queue: Queue,
  ) {}

  // Two ticks overlapping is fine, see the claim query below
  // This interval is the floor on how late a webhook can be
  @Cron(CronExpression.EVERY_5_SECONDS)
  async relay(): Promise<void> {
    try {
      const { deliveries, events } = await this.claimBatch();

      // Both after the commit, deliberately
      // Enqueuing inside would hand out a job id for a row a rollback removes
      // Its own try, because publishedAt is committed by the time I get here
      // A throw would skip the publish below and lose the event for good
      try {
        await enqueueDeliveries(this.queue, deliveries);

        if (deliveries.length > 0) {
          this.logger.log(`queued ${deliveries.length} webhook deliveries`);
        }
      } catch (error) {
        this.logger.error(`enqueue failed: ${String(error)}`);
      }

      await this.publisher.publish(events);
    } catch (error) {
      // Swallowed
      // The rows are still unpublished and the next tick is 5 seconds away
      this.logger.error(`relay failed: ${String(error)}`);
    }
  }

  private async claimBatch(): Promise<Claimed> {
    return this.prisma.$transaction(async (tx) => {
      // FOR UPDATE locks the rows I read so nobody else can take them
      // SKIP LOCKED then tells a second tick to walk past anything I hold
      // Without it the second tick waits, then wakes up holding published rows
      const events = await tx.$queryRaw<OutboxEvent[]>`
        SELECT * FROM outbox_event
        WHERE "publishedAt" IS NULL
        ORDER BY "createdAt"
        LIMIT ${BATCH_SIZE}
        FOR UPDATE SKIP LOCKED
      `;

      if (events.length === 0) {
        return { deliveries: [], events: [] };
      }

      const deliveries: Enqueueable[] = [];

      for (const event of events) {
        deliveries.push(...(await this.fanOut(tx, event)));
      }

      // Last, so a crash above rolls back and leaves the rows unpublished
      // Marking first would lose the event instead
      await tx.outboxEvent.updateMany({
        where: { id: { in: events.map((event) => event.id) } },
        data: { publishedAt: new Date() },
      });

      return { deliveries, events: events.map((e) => this.domainEvent(e)) };
    });
  }

  // One delivery row per endpoint that wants it
  // A merchant with no endpoints produces none and is still published
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
        // Due immediately
        // The sweep reads this, so a job lost before Redis still has a time
        nextAttemptAt: new Date(),
      })),
      // The unique index on endpoint plus event is the referee
      // A relay that dies after this insert runs the batch again
      // skipDuplicates is what stops the second run sending a second copy
      skipDuplicates: true,
    });

    // Read back rather than trusting the insert count
    // Rows a previous crashed run created get picked up and queued too
    return tx.webhookDelivery.findMany({
      where: { outboxEventId: event.id },
      select: { id: true, updatedAt: true },
    });
  }

  // What goes on the channel, and not the webhook body
  // That one is a contract with merchants, this one is mine to change
  private domainEvent(event: OutboxEvent): DomainEvent {
    return {
      id: event.id,
      type: event.eventType,
      merchantId: event.merchantId,
      mode: event.mode,
      createdAt: event.createdAt.toISOString(),
      data: event.payload,
    };
  }

  // The exact object the merchant receives, frozen into the row now
  // A retry has to send the same bytes it signed the first time
  private envelope(event: OutboxEvent): Prisma.InputJsonObject {
    return {
      id: event.id,
      type: event.eventType,
      createdAt: event.createdAt.toISOString(),
      data: event.payload,
    };
  }
}
