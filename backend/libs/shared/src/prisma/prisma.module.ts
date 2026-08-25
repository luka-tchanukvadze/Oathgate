import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

// Global because one database connection is cross-cutting
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
