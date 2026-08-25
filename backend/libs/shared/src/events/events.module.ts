import { Module } from '@nestjs/common';
import { EventPublisher } from './event-publisher.service';

// A module because this one owns a Redis connection: one per process, closed on
// shutdown
@Module({
  providers: [EventPublisher],
  exports: [EventPublisher],
})
export class EventsModule {}
