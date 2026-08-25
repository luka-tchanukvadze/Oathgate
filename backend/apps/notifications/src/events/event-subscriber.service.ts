import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { type DomainEvent, EVENTS_CHANNEL } from '@app/contracts';
import { Redis } from 'ioredis';
import { NotificationsPrismaService } from '../prisma/notifications-prisma.service';

@Injectable()
export class EventSubscriberService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(EventSubscriberService.name);
  private readonly redis: Redis;

  constructor(
    config: ConfigService,
    private readonly prisma: NotificationsPrismaService,
  ) {
    const url = new URL(config.getOrThrow<string>('REDIS_URL'));

    // Its own connection, and not for tidiness. Redis puts a connection into
    // subscriber mode and then refuses every other command on it
    this.redis = new Redis({
      host: url.hostname,
      port: url.port ? Number(url.port) : 6379,
      username: url.username || undefined,
      password: url.password || undefined,
      // A subscriber that stops reconnecting goes quiet without dying, which is
      // the worst way to fail
      maxRetriesPerRequest: null,
    });

    this.redis.on('error', (error) => {
      this.logger.error(`redis: ${error.message}`);
    });
  }

  async onModuleInit(): Promise<void> {
    this.redis.on('message', (_channel: string, raw: string) => {
      void this.receive(raw);
    });

    // Both, and I need both. ioredis connects from its constructor, so ready can
    // fire before I attach this and I would never hear it. The listener covers
    // reconnects, the call below covers the connection I already have
    this.redis.on('ready', () => void this.subscribe());

    await this.subscribe();
  }

  private async subscribe(): Promise<void> {
    try {
      await this.redis.subscribe(EVENTS_CHANNEL);
      this.logger.log(`subscribed to ${EVENTS_CHANNEL}`);
    } catch (error) {
      // Never thrown. The ready listener retries once the connection is back
      this.logger.error(`subscribe failed: ${String(error)}`);
    }
  }

  private async receive(raw: string): Promise<void> {
    const event = this.parse(raw);

    if (!event) {
      return;
    }

    try {
      // createMany for skipDuplicates. A redelivery is normal and should be
      // silent, not an error in the log
      const { count } = await this.prisma.receivedEvent.createMany({
        data: [
          {
            id: event.id,
            type: event.type,
            merchantId: event.merchantId,
            mode: event.mode,
            payload: event.data as object,
          },
        ],
        skipDuplicates: true,
      });

      if (count > 0) {
        this.logger.log(`stored ${event.type} ${event.id}`);
      }
    } catch (error) {
      // Nothing to retry against. Pub/sub handed this over once and will not
      // hand it back, so I say it was lost
      this.logger.error(`could not store ${event.id}: ${String(error)}`);
    }
  }

  // Bytes from another process, so I check rather than trust. A bad message must
  // not kill the service or, worse, write half a row
  private parse(raw: string): DomainEvent | null {
    let value: unknown;

    try {
      value = JSON.parse(raw);
    } catch {
      this.logger.warn(`ignoring a message that is not JSON`);
      return null;
    }

    if (typeof value !== 'object' || value === null) {
      this.logger.warn('ignoring a message that is not an object');
      return null;
    }

    const event = value as Partial<DomainEvent>;

    if (
      typeof event.id !== 'string' ||
      typeof event.type !== 'string' ||
      typeof event.merchantId !== 'string' ||
      (event.mode !== 'TEST' && event.mode !== 'LIVE')
    ) {
      this.logger.warn('ignoring a message with missing or wrong fields');
      return null;
    }

    return event as DomainEvent;
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit();
  }
}
