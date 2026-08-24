import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

// A second client for a second database. It looks almost identical to the
// gateway's on purpose: the point is not that the code differs, it is that this
// one physically cannot reach the payment tables
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

    // Parsed rather than logged whole, the connection string carries a password
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
