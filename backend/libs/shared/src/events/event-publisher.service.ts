import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { type DomainEvent, EVENTS_CHANNEL } from '@app/contracts';
import { redisConnection, redisTarget } from '../queue/redis-connection';

@Injectable()
export class EventPublisher implements OnModuleDestroy {
  private readonly logger = new Logger(EventPublisher.name);
  private readonly redis: Redis;
  private readonly target: string;

  constructor(config: ConfigService) {
    const url = config.getOrThrow<string>('REDIS_URL');

    this.target = redisTarget(url);

    // I override the queue's retry policy here. A worker can wait forever on a
    // blocking read, but this runs on a 5 second clock and has to fail fast
    this.redis = new Redis({
      ...redisConnection(url),
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });

    // Otherwise a dropped connection is an unhandled error and takes the process
    this.redis.on('error', (error) => {
      this.logger.error(`redis at ${this.target}: ${error.message}`);
    });
  }

  // Best effort, and that is the thing to remember. Pub/sub keeps nothing: a
  // message sent with no subscriber is gone, not queued. Webhooks survive an
  // outage because they are rows in Postgres, these do not
  async publish(events: DomainEvent[]): Promise<void> {
    if (events.length === 0) {
      return;
    }

    try {
      const pipeline = this.redis.pipeline();

      for (const event of events) {
        pipeline.publish(EVENTS_CHANNEL, JSON.stringify(event));
      }

      // exec never throws, it hands back an [error, result] per command. Without
      // this a publish that failed on every event still logged success
      const results = await pipeline.exec();
      const failed = (results ?? []).filter(([error]) => error !== null).length;

      if (failed > 0) {
        this.logger.error(
          `${failed} of ${events.length} events did not publish`,
        );

        return;
      }

      this.logger.log(`published ${events.length} events`);
    } catch (error) {
      // Swallowed so a pub/sub problem never stops a webhook. Same relay, and
      // deliberately not the same fate
      this.logger.error(`publish failed: ${String(error)}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}
