import {
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { KeyMode, SettlementService } from '@app/shared';
import { toCheckoutResponse } from './checkout.response';
import { CheckoutService } from './checkout.service';

// No guard anywhere in this file
// A customer paying a shop has no account here and never will
@Controller('checkout')
export class CheckoutController {
  constructor(
    private readonly checkout: CheckoutService,
    private readonly settlement: SettlementService,
  ) {}

  @Get(':id')
  async get(@Param('id', ParseUUIDPipe) id: string) {
    const payment = await this.checkout.get(id);

    return toCheckoutResponse(payment);
  }

  // Stands in for the customer's wallet, so somebody without testnet coins can
  // still watch a payment settle
  //
  // Test mode only, and ten a minute rather than sixty
  @Post(':id/confirm')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async confirm(@Param('id', ParseUUIDPipe) id: string) {
    const payment = await this.checkout.get(id);

    if (payment.mode !== KeyMode.TEST) {
      throw new ForbiddenException('confirm is only available in test mode');
    }

    await this.settlement.settle(payment.merchantId, id);

    const settled = await this.checkout.get(id);

    return toCheckoutResponse(settled);
  }
}
