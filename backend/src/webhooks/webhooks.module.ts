import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { QueueModule } from '../queue/queue.module';
import { OutboxRelayService } from './delivery/outbox-relay.service';
import { WebhookProcessor } from './delivery/webhook.processor';
import { WebhookRetryService } from './delivery/webhook-retry.service';
import { WebhookSenderService } from './delivery/webhook-sender.service';
import { DashboardWebhooksController } from './endpoints/dashboard-webhooks.controller';
import { WebhooksService } from './endpoints/webhooks.service';
import { DashboardDeliveriesController } from './log/dashboard-deliveries.controller';
import { DeliveriesService } from './log/deliveries.service';
import { SecretCipher } from './secret-cipher';

@Module({
  imports: [AuthModule, QueueModule],
  controllers: [DashboardWebhooksController, DashboardDeliveriesController],
  providers: [
    WebhooksService,
    SecretCipher,
    OutboxRelayService,
    WebhookSenderService,
    WebhookProcessor,
    WebhookRetryService,
    DeliveriesService,
  ],
  exports: [WebhooksService, SecretCipher],
})
export class WebhooksModule {}
