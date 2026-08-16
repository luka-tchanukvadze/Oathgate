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
          // Finished jobs are dropped from Redis. Postgres already holds the
          // delivery history, and a queue that remembers everything fills the
          // box it runs on
          removeOnComplete: 100,
          removeOnFail: 500,
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
