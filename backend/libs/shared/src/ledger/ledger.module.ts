import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AccountsService } from './accounts.service';
import { LedgerService } from './ledger.service';

// The write path only
// Reading the ledger for a dashboard is the api's business and stays there
@Module({
  imports: [PrismaModule],
  providers: [LedgerService, AccountsService],
  exports: [LedgerService, AccountsService],
})
export class LedgerModule {}
