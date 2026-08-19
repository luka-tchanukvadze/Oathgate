import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Queue } from 'bullmq';
import {
  PrismaService,
  WEBHOOK_QUEUE,
  WebhookDeliveryStatus,
} from '@app/shared';
import { enqueueDeliveries } from './enqueue';

const BATCH_SIZE = 100;

@Injectable()
export class WebhookRetryService {
  private readonly logger = new Logger(WebhookRetryService.name);

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(WEBHOOK_QUEUE) private readonly queue: Queue,
  ) {}

  // This is what makes Redis optional rather than load bearing. Whether a job
  // was lost in an outage or is simply due for its next try, the row in Postgres
  // says so, and this puts it back on the queue
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

      // No status change here. The row stays PENDING until a worker actually
      // reports back, so a job lost between here and Redis is simply found again
      await enqueueDeliveries(this.queue, due);

      this.logger.log(`requeued ${due.length} webhook deliveries`);
    } catch (error) {
      this.logger.error(`retry sweep failed: ${String(error)}`);
    }
  }
}
