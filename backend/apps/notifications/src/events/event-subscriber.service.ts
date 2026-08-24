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

    // A connection of its own, and not because of tidiness. Redis puts a
    // connection into subscriber mode and then refuses every other command on
    // it, so this one can never be reused for anything else
    this.redis = new Redis({
      host: url.hostname,
      port: url.port ? Number(url.port) : 6379,
      username: url.username || undefined,
      password: url.password || undefined,
      // A subscriber that gives up reconnecting is a service that goes quiet
      // without dying, which is the worst way to fail
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

    // Twice, and both are needed. The driver connects from its constructor, so
    // by the time this hook runs the connection may already be ready and a
    // listener added now would never hear that event, leaving the service alive
    // and silent. Subscribing directly covers the first connection, and the
    // listener covers every reconnect after it, because Redis does not remember
    // what a dropped connection was listening to
    this.redis.on('ready', () => void this.subscribe());

    await this.subscribe();
  }

  private async subscribe(): Promise<void> {
    try {
      await this.redis.subscribe(EVENTS_CHANNEL);
      this.logger.log(`subscribed to ${EVENTS_CHANNEL}`);
    } catch (error) {
      // Never thrown. A subscribe that fails at boot is retried by the ready
      // listener as soon as the connection comes back
      this.logger.error(`subscribe failed: ${String(error)}`);
    }
  }

  private async receive(raw: string): Promise<void> {
    const event = this.parse(raw);

    if (!event) {
      return;
    }

    try {
      // createMany rather than create, for skipDuplicates. A redelivered event
      // is normal and must be silent, not an error in the log
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
      // Nothing to retry against. Pub/sub has already handed the message over
      // and will not hand it back, so the honest thing is to say it was lost
      this.logger.error(`could not store ${event.id}: ${String(error)}`);
    }
  }

  // Anything arriving on a channel is bytes from another process, so it gets
  // checked rather than trusted. A malformed message must not take the service
  // down or, worse, write a half-populated row
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
