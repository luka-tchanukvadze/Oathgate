import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { IdempotencyModule } from '../idempotency/idempotency.module';
import { LedgerModule } from '../ledger/ledger.module';
import { RatesModule } from '../rates/rates.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { SettlementService } from './settlement.service';

@Module({
  imports: [AuthModule, RatesModule, IdempotencyModule, LedgerModule],
  controllers: [PaymentsController],
  providers: [PaymentsService, SettlementService],
  exports: [PaymentsService, SettlementService],
})
export class PaymentsModule {}
