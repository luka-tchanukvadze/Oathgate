import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

// Global because one database connection is cross-cutting, and the
// alternative is importing this into every module the phase adds
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
