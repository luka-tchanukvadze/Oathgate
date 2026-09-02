import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DashboardLedgerController } from './dashboard-ledger.controller';
import { LedgerQueryService } from './ledger-query.service';

// Reading only
// Writing to the ledger moved to the shared lib, because the worker settles too
@Module({
  imports: [AuthModule],
  controllers: [DashboardLedgerController],
  providers: [LedgerQueryService],
  exports: [LedgerQueryService],
})
export class DashboardLedgerModule {}
