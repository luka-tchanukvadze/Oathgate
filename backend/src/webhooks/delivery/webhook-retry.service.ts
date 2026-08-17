import { InjectQueue } from '@nestjs/bullmq';
import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { Queue } from 'bullmq';
import { WebhookDeliveryStatus } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { WEBHOOK_JOB, WEBHOOK_QUEUE } from '../../queue/queue.constants';
import { webhookJobId } from './webhook.constants';

const BATCH_SIZE = 100;

const ENQUEUE_TIMEOUT_MS = 5_000;

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
        select: { id: true, attempts: true },
      });

      if (due.length === 0) {
        return;
      }

      // No status change here. The row stays PENDING until a worker actually
      // reports back, so a job lost between here and Redis is simply found again
      await Promise.race([
        this.queue.addBulk(
          due.map((delivery) => ({
            name: WEBHOOK_JOB,
            data: { deliveryId: delivery.id },
            opts: { jobId: webhookJobId(delivery.id, delivery.attempts) },
          })),
        ),
        new Promise<never>((_, reject) =>
          setTimeout(
            () =>
              reject(
                new Error(`redis did not answer in ${ENQUEUE_TIMEOUT_MS}ms`),
              ),
            ENQUEUE_TIMEOUT_MS,
          ),
        ),
      ]);

      this.logger.log(`requeued ${due.length} webhook deliveries`);
    } catch (error) {
      this.logger.error(`retry sweep failed: ${String(error)}`);
    }
  }
}
