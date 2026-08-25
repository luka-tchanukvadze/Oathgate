import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedMerchant } from '../auth/auth.types';
import { CurrentMerchant } from '../auth/decorators/current-merchant.decorator';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { KeyMode } from '@app/shared';
import { IdempotencyService } from '../idempotency/idempotency.service';
import { hashRequest } from '../idempotency/request-hash';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { ListPaymentsDto } from './dto/list-payments.dto';
import { toPaymentResponse } from './payment.response';
import { PaymentsService } from './payments.service';
import { SettlementService } from './settlement.service';

// Matches the column, so an oversized key is a 400 not a write error
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
    // Required, not optional
    // A retried create without one is a second invoice for the same order
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

  @Get()
  async list(
    @CurrentMerchant() merchant: AuthenticatedMerchant,
    @Query() query: ListPaymentsDto,
  ) {
    const page = await this.payments.list(
      merchant.merchantId,
      merchant.mode,
      query,
    );

    return { data: page.data.map(toPaymentResponse), hasMore: page.hasMore };
  }

  // Declared after the literal routes above
  // Nest matches in handler order, so :id would swallow /v1/payments/x
  @Get(':id')
  async get(
    @CurrentMerchant() merchant: AuthenticatedMerchant,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const payment = await this.payments.get(
      merchant.merchantId,
      merchant.mode,
      id,
    );

    return toPaymentResponse(payment);
  }

  // Stands in for the chain until phase 4 watches a real one
  // Test mode only: in live the blockchain decides, not an endpoint of mine
  // Settling twice is already a no-op, so no idempotency key
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
