import { Module } from '@nestjs/common';
import { QueueModule, SecretCipher } from '@app/shared';
import { AuthModule } from '../auth/auth.module';
import { DashboardWebhooksController } from './endpoints/dashboard-webhooks.controller';
import { WebhooksService } from './endpoints/webhooks.service';
import { DashboardDeliveriesController } from './log/dashboard-deliveries.controller';
import { DeliveriesService } from './log/deliveries.service';

// Controllers only. The relay, the sender and the retry sweep moved to the
// worker, so nothing in here sends anything. QueueModule stays because a manual
// replay still puts a job on the queue for the worker to pick up
@Module({
  imports: [AuthModule, QueueModule],
  controllers: [DashboardWebhooksController, DashboardDeliveriesController],
  providers: [WebhooksService, SecretCipher, DeliveriesService],
  exports: [WebhooksService, SecretCipher],
})
export class WebhooksModule {}
