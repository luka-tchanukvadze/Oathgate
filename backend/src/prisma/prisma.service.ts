import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

// Prisma 7 ships no query engine binary, so the client gets a real Postgres
// driver instead. The CLI reads its URL from prisma.config.ts and this reads
// its own, so a mismatch migrates one database and queries another
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

    // Parsed rather than logged whole, the connection string carries a password
    const { host, port, pathname } = new URL(url);
    this.target = `${host}:${port}${pathname}`;
  }

  // Connecting at boot means a bad URL kills startup instead of the first payment
  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log(`connected to ${this.target}`);
  }

  // Without this the pool outlives every hot reload until Postgres stops
  // accepting new clients
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
