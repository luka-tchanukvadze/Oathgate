import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { QueueHealthService } from './queue-health.service';
import { WEBHOOK_QUEUE } from './queue.constants';
import { redisConnection } from './redis-connection';

@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: redisConnection(config.getOrThrow<string>('REDIS_URL')),
        defaultJobOptions: {
          // Dropped the moment they finish, not kept as a recent-history
          // window. Postgres already holds the delivery history, and a finished
          // job that lingers keeps its id reserved: the retry sweep would then
          // be silently refused when it tries to queue that delivery again
          removeOnComplete: true,
          removeOnFail: true,
        },
      }),
    }),
    BullModule.registerQueue({ name: WEBHOOK_QUEUE }),
  ],
  providers: [QueueHealthService],
  // BullModule, so anything importing this can inject the queue itself
  exports: [BullModule],
})
export class QueueModule {}
