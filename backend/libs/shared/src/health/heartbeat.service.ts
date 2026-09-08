import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from 'ioredis';
import { redisConnection, redisTarget } from '../queue/redis-connection';

// A background job that dies is invisible. It stops writing rows, stops
// logging, and every screen carries on showing the last thing it wrote. So each
// one leaves a timestamp behind and something else can notice it went quiet
//
// Three of the eight scheduled jobs, not all of them: see the money arrive,
// credit it, tell the merchant. Those are the steps where going quiet means the
// gateway is lying to somebody. The rest fail in ways that show up on a screen
// on their own, and a status page of eight green ticks is one nobody reads
export const CHAIN_WATCHER = 'chain-watcher';
export const CHAIN_SETTLEMENT = 'chain-settlement';
export const OUTBOX_RELAY = 'outbox-relay';

@Injectable()
export class HeartbeatService implements OnModuleDestroy {
  private readonly logger = new Logger(HeartbeatService.name);
  private readonly redis: Redis;
  private readonly target: string;

  // Redis rather than a table. A heartbeat is worth nothing after a restart,
  // and losing one costs a sweep of not knowing rather than anything real
  constructor(config: ConfigService) {
    const url = config.getOrThrow<string>('REDIS_URL');

    this.target = redisTarget(url);

    // The queue's policy is to wait for ever, which is right for a blocking
    // read and wrong here. Both callers are on a clock: a cron that must not
    // stall and a request that must not hang
    this.redis = new Redis({
      ...redisConnection(url),
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
    });

    // Otherwise a dropped connection is unhandled and kills the process
    this.redis.on('error', (error) => {
      this.logger.error(`redis at ${this.target}: ${error.message}`);
    });
  }

  // Never throws. A job brought down by its own health reporting is worse off
  // than one nobody is watching
  async beat(name: string): Promise<void> {
    try {
      await this.redis.set(this.key(name), Date.now().toString());
    } catch (error) {
      this.logger.warn(`could not record ${name} as alive: ${String(error)}`);
    }
  }

  // Null means never seen, which reads the same as long dead and is treated the
  // same way by everything above
  async lastBeat(name: string): Promise<Date | null> {
    try {
      const value = await this.redis.get(this.key(name));

      return value ? new Date(Number(value)) : null;
    } catch (error) {
      this.logger.warn(
        `could not read whether ${name} is alive: ${String(error)}`,
      );

      return null;
    }
  }

  async onModuleDestroy(): Promise<void> {
    // quit sends a command, and there is nowhere to send it if the connection
    // never came up, so shutting down while redis is already gone threw out of
    // the shutdown hook
    // Nothing here is worth keeping, so failing to say goodbye politely just
    // means dropping the socket
    try {
      await this.redis.quit();
    } catch {
      this.redis.disconnect();
    }
  }

  private key(name: string): string {
    return `oathgate:heartbeat:${name}`;
  }
}
