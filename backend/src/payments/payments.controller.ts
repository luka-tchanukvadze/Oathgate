import { Body, Controller, Post, UseGuards } from '@nestjs/common';
import type { AuthenticatedMerchant } from '../auth/auth.types';
import { CurrentMerchant } from '../auth/decorators/current-merchant.decorator';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { toPaymentResponse } from './payment.response';
import { PaymentsService } from './payments.service';

@Controller('v1/payments')
@UseGuards(ApiKeyGuard)
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post()
  async create(
    @CurrentMerchant() merchant: AuthenticatedMerchant,
    @Body() dto: CreatePaymentDto,
  ) {
    const payment = await this.payments.create(merchant, dto);

    return toPaymentResponse(payment);
  }
}
