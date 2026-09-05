import {
  Body,
  Controller,
  ConflictException,
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
import { KeyMode, PaymentStatus, SettlementService } from '@app/shared';
import { requireIdempotencyKey } from '../idempotency/idempotency-key';
import { IdempotencyService } from '../idempotency/idempotency.service';
import { hashRequest } from '../idempotency/request-hash';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { ListPaymentsDto } from './dto/list-payments.dto';
import { ReversePaymentDto } from './dto/reverse-payment.dto';
import { toPaymentResponse } from './payment.response';
import { PaymentsService } from './payments.service';

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
    const key = requireIdempotencyKey(idempotencyKey);

    return this.idempotency.run({
      merchantId: merchant.merchantId,
      key,
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

  // A refund, and the one place the append only rule earns its keep
  // Nothing is deleted: the original pair stays and an opposite pair is written
  // next to it, each new entry naming the one it undoes
  //
  // No idempotency key, because calling it twice is already safe
  // The second call finds no entries left to undo and changes nothing
  @Post(':id/reverse')
  @HttpCode(200)
  async reverse(
    @CurrentMerchant() merchant: AuthenticatedMerchant,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReversePaymentDto,
  ) {
    const { payment, reversed } = await this.settlement.reverse(
      merchant.merchantId,
      id,
      dto.reason,
    );

    // Already reversed answers 200 with the same body the first call gave
    // Anything else never had money to take back, and saying so is more use
    // than a 200 that quietly did nothing
    if (!reversed && payment.status !== PaymentStatus.REVERSED) {
      throw new ConflictException(
        `only a paid payment can be reversed, this one is ${payment.status}`,
      );
    }

    return toPaymentResponse(payment);
  }
}
