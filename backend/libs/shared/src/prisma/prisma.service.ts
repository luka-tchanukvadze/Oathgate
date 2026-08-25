import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

// Prisma 7 ships no query engine, so the client needs a real driver
// The CLI reads its URL from prisma.config.ts and this reads its own
// A mismatch would migrate one database and query another
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);
  private readonly target: string;

  constructor(config: ConfigService) {
    const url = config.getOrThrow<string>('DATABASE_URL');

    super({
      adapter: new PrismaPg({ connectionString: url }),
    });

    // Parsed, not logged whole, because the string carries a password
    // hostname and not host, because host already has the port on it
    const { hostname, port, pathname } = new URL(url);
    this.target = `${hostname}:${port}${pathname}`;
  }

  // Connecting at boot means a bad URL kills startup, not the first payment
  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log(`connected to ${this.target}`);
  }

  // Without this the pool outlives every hot reload until Postgres refuses
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
