import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedMerchant } from '../auth/auth.types';
import { CurrentMerchant } from '../auth/decorators/current-merchant.decorator';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { IdempotencyService } from '../idempotency/idempotency.service';
import { hashRequest } from '../idempotency/request-hash';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { toPaymentResponse } from './payment.response';
import { PaymentsService } from './payments.service';

// Matches the column, so an oversized key is a 400 rather than a write error
const MAX_KEY_LENGTH = 255;

@Controller('v1/payments')
@UseGuards(ApiKeyGuard)
export class PaymentsController {
  constructor(
    private readonly payments: PaymentsService,
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
}
