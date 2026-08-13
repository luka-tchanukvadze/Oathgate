import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { RatesModule } from '../rates/rates.module';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [AuthModule, RatesModule],
  controllers: [PaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
