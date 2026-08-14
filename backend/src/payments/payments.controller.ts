import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedMerchant } from '../auth/auth.types';
import { CurrentMerchant } from '../auth/decorators/current-merchant.decorator';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { KeyMode } from '../generated/prisma/client';
import { IdempotencyService } from '../idempotency/idempotency.service';
import { hashRequest } from '../idempotency/request-hash';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { toPaymentResponse } from './payment.response';
import { PaymentsService } from './payments.service';
import { SettlementService } from './settlement.service';

// Matches the column, so an oversized key is a 400 rather than a write error
const MAX_KEY_LENGTH = 255;

@Controller('v1/payments')
@UseGuards(ApiKeyGuard)
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly settlement: SettlementService,
    private readonly idempotency: IdempotencyService,
  ) {}

  @Post()
  async create(
    @CurrentMerchant() merchant: AuthenticatedMerchant,
    @Body() dto: CreatePaymentDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    // Required, not optional. A retried create without one is a second invoice
    // for the same order, and this endpoint is where money starts
    if (!idempotencyKey || idempotencyKey.length > MAX_KEY_LENGTH) {
      throw new BadRequestException(
        `Idempotency-Key header is required and must be at most ${MAX_KEY_LENGTH} characters`,
      );
    }

    return this.idempotency.run({
      merchantId: merchant.merchantId,
      key: idempotencyKey,
      requestHash: hashRequest(dto),
      successStatus: 201,
      handler: async () =>
        toPaymentResponse(await this.payments.create(merchant, dto)),
    });
  }

  // Stands in for the chain until phase 4 watches a real one. Test mode only:
  // in live, the blockchain decides when money is real and no endpoint of mine
  // gets a say. 200 rather than 201 because nothing new is created, and no
  // idempotency key because settling twice is already a no-op
  @Post(':id/confirm')
  @HttpCode(200)
  async confirm(
    @CurrentMerchant() merchant: AuthenticatedMerchant,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    if (merchant.mode !== KeyMode.TEST) {
      throw new ForbiddenException('confirm is only available in test mode');
    }

    const { payment } = await this.settlement.settle(merchant.merchantId, id);

    return toPaymentResponse(payment);
  }
}
