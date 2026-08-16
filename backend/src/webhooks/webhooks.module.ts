import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DashboardWebhooksController } from './dashboard-webhooks.controller';
import { SecretCipher } from './secret-cipher';
import { WebhooksService } from './webhooks.service';

@Module({
  imports: [AuthModule],
  controllers: [DashboardWebhooksController],
  providers: [WebhooksService, SecretCipher],
  exports: [WebhooksService, SecretCipher],
})
export class WebhooksModule {}
