import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { WEBHOOK_QUEUE } from '@app/shared';
import { WebhookSenderService } from './webhook-sender.service';

interface WebhookJob {
  deliveryId: string;
}

// 5 at a time. The work is almost entirely waiting on someone else's server, so
// running several is nearly free, and the cap is what stops one slow merchant
// occupying every slot
@Processor(WEBHOOK_QUEUE, { concurrency: 5 })
export class WebhookProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhookProcessor.name);

  constructor(private readonly sender: WebhookSenderService) {
    super();
  }

  // Swallows on purpose. Letting this throw hands the job to BullMQ's own retry,
  // which would be a second schedule running next to the one in Postgres, and
  // two schedules disagreeing about when to try again is worse than either. The
  // row is still PENDING with a time on it, so the sweep picks it up
  async process(job: Job<WebhookJob>): Promise<void> {
    try {
      await this.sender.deliver(job.data.deliveryId);
    } catch (error) {
      this.logger.error(
        `delivery ${job.data.deliveryId} threw: ${String(error)}`,
      );
    }
  }
}
