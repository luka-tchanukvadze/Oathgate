import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

// A second client for a second database
// The point is not that the code differs
// It is that this one cannot reach the payment tables at all
@Injectable()
export class NotificationsPrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(NotificationsPrismaService.name);
  private readonly target: string;

  constructor(config: ConfigService) {
    const url = config.getOrThrow<string>('NOTIFICATIONS_DATABASE_URL');

    super({
      adapter: new PrismaPg({ connectionString: url }),
    });

    // Parsed, not logged whole, because the string carries a password
    const { hostname, port, pathname } = new URL(url);
    this.target = `${hostname}:${port}${pathname}`;
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log(`connected to ${this.target}`);
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
