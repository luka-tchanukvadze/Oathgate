import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { AccountsService } from './accounts.service';
import { DashboardLedgerController } from './dashboard-ledger.controller';
import { LedgerQueryService } from './ledger-query.service';
import { LedgerService } from './ledger.service';

@Module({
  imports: [AuthModule],
  controllers: [DashboardLedgerController],
  providers: [LedgerService, AccountsService, LedgerQueryService],
  exports: [LedgerService, AccountsService, LedgerQueryService],
})
export class LedgerModule {}
