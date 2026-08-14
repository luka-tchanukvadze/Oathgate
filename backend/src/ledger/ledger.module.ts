import { Module } from '@nestjs/common';
import { AccountsService } from './accounts.service';
import { LedgerService } from './ledger.service';

@Module({
  providers: [LedgerService, AccountsService],
  exports: [LedgerService, AccountsService],
})
export class LedgerModule {}
