import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { QueueModule } from '../queue/queue.module';
import { DashboardWebhooksController } from './dashboard-webhooks.controller';
import { OutboxRelayService } from './outbox-relay.service';
import { SecretCipher } from './secret-cipher';
import { WebhooksService } from './webhooks.service';

@Module({
  imports: [AuthModule, QueueModule],
  controllers: [DashboardWebhooksController],
  providers: [WebhooksService, SecretCipher, OutboxRelayService],
  exports: [WebhooksService, SecretCipher],
})
export class WebhooksModule {}
