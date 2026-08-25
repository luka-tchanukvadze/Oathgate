import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { MailerService } from './email/mailer.service';
import { EventProcessorService } from './events/event-processor.service';
import { EventSubscriberService } from './events/event-subscriber.service';
import { NotificationsPrismaService } from './prisma/notifications-prisma.service';

// No @app/shared here, on purpose
// This service gets the event contract and its own database, nothing else
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), ScheduleModule.forRoot()],
  providers: [
    NotificationsPrismaService,
    EventSubscriberService,
    EventProcessorService,
    MailerService,
  ],
})
export class NotificationsModule {}
