import { Module } from '@nestjs/common';
import { QueueModule, SecretCipher } from '@app/shared';
import { AuthModule } from '../auth/auth.module';
import { DashboardWebhooksController } from './endpoints/dashboard-webhooks.controller';
import { WebhooksService } from './endpoints/webhooks.service';
import { DashboardDeliveriesController } from './log/dashboard-deliveries.controller';
import { DeliveriesService } from './log/deliveries.service';

// Controllers only, the relay and sender live in the worker now
// QueueModule stays because a replay still puts a job on the queue
@Module({
  imports: [AuthModule, QueueModule],
  controllers: [DashboardWebhooksController, DashboardDeliveriesController],
  providers: [WebhooksService, SecretCipher, DeliveriesService],
  exports: [WebhooksService, SecretCipher],
})
export class WebhooksModule {}
