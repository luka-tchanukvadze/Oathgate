import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import {
  EventsModule,
  PrismaModule,
  QueueModule,
  SecretCipher,
} from '@app/shared';
import { ExpiryService } from './payments/expiry.service';
import { OutboxRelayService } from './webhooks/outbox-relay.service';
import { WebhookProcessor } from './webhooks/webhook.processor';
import { WebhookRetryService } from './webhooks/webhook-retry.service';
import { WebhookSenderService } from './webhooks/webhook-sender.service';

// Nothing here is started by a request, so there are no controllers
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    QueueModule,
    EventsModule,
  ],
  providers: [
    ExpiryService,
    OutboxRelayService,
    WebhookSenderService,
    WebhookProcessor,
    WebhookRetryService,
    // The decrypt half
    // The api has its own instance to encrypt with, and that is fine
    // It is a key read from config, not shared state
    SecretCipher,
  ],
})
export class WorkerModule {}
