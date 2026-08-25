import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { WEBHOOK_QUEUE } from '@app/shared';
import { WebhookSenderService } from './webhook-sender.service';

interface WebhookJob {
  deliveryId: string;
}

// 5 at a time
// This is nearly all waiting on someone else's server, so several is cheap
// The cap is what stops one slow merchant taking every slot
@Processor(WEBHOOK_QUEUE, { concurrency: 5 })
export class WebhookProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhookProcessor.name);

  constructor(private readonly sender: WebhookSenderService) {
    super();
  }

  // Swallows on purpose
  // Throwing hands the job to BullMQ's own retry
  // Then two schedules disagree about the next try, which is worse
  // Postgres decides, and the sweep picks the row up
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
