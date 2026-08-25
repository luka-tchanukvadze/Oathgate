import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Queue } from 'bullmq';
import {
  enqueueDeliveries,
  PrismaService,
  WEBHOOK_QUEUE,
  WebhookDeliveryStatus,
} from '@app/shared';

const BATCH_SIZE = 100;

@Injectable()
export class WebhookRetryService {
  private readonly logger = new Logger(WebhookRetryService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(WEBHOOK_QUEUE) private readonly queue: Queue,
  ) {}

  // This is what makes Redis optional rather than load bearing
  // Lost in an outage or simply due, the row in Postgres says so
  @Cron(CronExpression.EVERY_10_SECONDS)
  async sweep(): Promise<void> {
    try {
      const due = await this.prisma.webhookDelivery.findMany({
        where: {
          status: WebhookDeliveryStatus.PENDING,
          nextAttemptAt: { lte: new Date() },
        },
        orderBy: { nextAttemptAt: 'asc' },
        take: BATCH_SIZE,
        select: { id: true, updatedAt: true },
      });

      if (due.length === 0) {
        return;
      }

      // No status change here
      // The row stays PENDING until a worker reports back
      // A job lost between here and Redis is found again next sweep
      await enqueueDeliveries(this.queue, due);

      this.logger.log(`requeued ${due.length} webhook deliveries`);
    } catch (error) {
      this.logger.error(`retry sweep failed: ${String(error)}`);
    }
  }
}
