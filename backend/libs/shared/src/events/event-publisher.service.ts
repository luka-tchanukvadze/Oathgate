import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { EVENTS_CHANNEL } from './event.constants';
import type { DomainEvent } from './event.types';
import { redisConnection, redisTarget } from '../queue/redis-connection';

@Injectable()
export class EventPublisher implements OnModuleDestroy {
  private readonly logger = new Logger(EventPublisher.name);
  private readonly redis: Redis;
  private readonly target: string;

  constructor(config: ConfigService) {
    const url = config.getOrThrow<string>('REDIS_URL');

    this.target = redisTarget(url);

    // Its own connection, and its own retry policy, which is why the queue's
    // setting is spread first and then overridden. The queue needs commands to
    // wait forever because a worker holds a blocking read open. A publish is the
    // opposite: it runs on a 5 second clock, so it has to fail now rather than
    // queue up behind a Redis that is down
    this.redis = new Redis({
      ...redisConnection(url),
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });

    // Otherwise a dropped connection surfaces as an unhandled error event and
    // takes the process with it
    this.redis.on('error', (error) => {
      this.logger.error(`redis at ${this.target}: ${error.message}`);
    });
  }

  // Best effort on purpose, and this is the one thing to remember about it.
  // Redis pub/sub has no durability: a message published while nothing is
  // subscribed is gone, not queued. Webhooks survive an outage because their
  // deliveries are rows in Postgres. These do not
  async publish(events: DomainEvent[]): Promise<void> {
    if (events.length === 0) {
      return;
    }

    try {
      const pipeline = this.redis.pipeline();

      for (const event of events) {
        pipeline.publish(EVENTS_CHANNEL, JSON.stringify(event));
      }

      // exec resolves with a [error, result] pair per command and throws for
      // none of them. Without this check a publish that failed on every single
      // event still logged success, which is worse than the failure
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
      // Swallowed rather than rethrown, so a pub/sub problem can never stop a
      // webhook going out. The two paths share a relay, not a fate
      this.logger.error(`publish failed: ${String(error)}`);
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}
