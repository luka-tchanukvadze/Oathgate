import { Module } from '@nestjs/common';
import { EventPublisher } from './event-publisher.service';

// A module rather than listing the provider in each app, because this one owns a
// Redis connection. One instance per process, closed on shutdown
@Module({
  providers: [EventPublisher],
  exports: [EventPublisher],
})
export class EventsModule {}
