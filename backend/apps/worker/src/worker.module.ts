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

// No controllers, and there never will be. Everything here is started by a clock
// or by a job arriving, never by a request
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
    // Decrypts a stored secret to sign with. The api holds its own instance for
    // the encrypt half, which is fine: it is a key from config, not shared state
    SecretCipher,
  ],
})
export class WorkerModule {}
