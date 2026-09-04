import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { IdempotencyModule } from '../idempotency/idempotency.module';
import { SettlementModule } from '@app/shared';
import { RatesModule } from '../rates/rates.module';
import { AddressService } from './address.service';
import { DashboardPaymentsController } from './dashboard-payments.controller';
import { PaymentDetailService } from './payment-detail.service';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [AuthModule, RatesModule, IdempotencyModule, SettlementModule],
  controllers: [PaymentsController, DashboardPaymentsController],
  providers: [AddressService, PaymentDetailService, PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
