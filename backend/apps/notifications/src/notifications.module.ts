import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventSubscriberService } from './events/event-subscriber.service';
import { NotificationsPrismaService } from './prisma/notifications-prisma.service';

// Note what is absent: no PrismaModule from @app/shared, no QueueModule, no
// import of @app/shared at all. This service knows the event contract and its
// own database, and nothing else about the gateway
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  providers: [NotificationsPrismaService, EventSubscriberService],
})
export class NotificationsModule {}
