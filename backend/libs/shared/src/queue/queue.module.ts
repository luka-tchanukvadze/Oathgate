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
          // Dropped as soon as they finish, because Postgres holds the history
          // A finished job that lingers keeps its id reserved
          // The retry sweep would then be silently refused
          removeOnComplete: true,
          removeOnFail: true,
        },
      }),
    }),
    BullModule.registerQueue({ name: WEBHOOK_QUEUE }),
  ],
  providers: [QueueHealthService],
  exports: [BullModule],
})
export class QueueModule {}
