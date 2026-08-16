import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { WEBHOOK_QUEUE } from './queue.constants';
import { redisTarget } from './redis-connection';

// 3 seconds. maxRetriesPerRequest is null, so the driver keeps retrying a dead
// Redis rather than giving up, and waiting for ready would never resolve.
// Without a deadline this check would hang startup instead of reporting it
const READY_TIMEOUT_MS = 3_000;

@Injectable()
export class QueueHealthService implements OnModuleInit {
  private readonly logger = new Logger(QueueHealthService.name);

  constructor(
    @InjectQueue(WEBHOOK_QUEUE) private readonly queue: Queue,
    private readonly config: ConfigService,
  ) {}

  // Logged, never thrown. A dead Redis delays webhooks, it does not stop
  // payments settling, and refusing to boot would turn something degraded into
  // something offline
  async onModuleInit(): Promise<void> {
    const target = redisTarget(this.config.getOrThrow<string>('REDIS_URL'));

    try {
      await Promise.race([
        this.queue.waitUntilReady(),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`no answer within ${READY_TIMEOUT_MS}ms`)),
            READY_TIMEOUT_MS,
          ),
        ),
      ]);

      this.logger.log(`connected to ${target}`);
    } catch (error) {
      this.logger.error(
        `redis at ${target} is not answering, webhooks will queue up: ${String(error)}`,
      );
    }
  }
}
