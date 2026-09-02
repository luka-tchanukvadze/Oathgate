import { Module } from '@nestjs/common';
import { LedgerModule } from '../ledger/ledger.module';
import { PrismaModule } from '../prisma/prisma.module';
import { SettlementService } from './settlement.service';

// Shared because two callers settle
// The api does it from a test endpoint, the worker does it from the chain
@Module({
  imports: [PrismaModule, LedgerModule],
  providers: [SettlementService],
  exports: [SettlementService],
})
export class SettlementModule {}
