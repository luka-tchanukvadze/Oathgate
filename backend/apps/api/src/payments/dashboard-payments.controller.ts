import {
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
import type { AuthenticatedSession } from '../auth/auth.types';
import { CurrentSession } from '../auth/decorators/current-session.decorator';
import { SessionGuard } from '../auth/guards/session.guard';
import { KeyMode, SettlementService } from '@app/shared';
import { toLedgerEntryResponse } from '../ledger/ledger.response';
import { toDeliveryResponse } from '../webhooks/log/delivery.response';
import { requireIdempotencyKey } from '../idempotency/idempotency-key';
import { IdempotencyService } from '../idempotency/idempotency.service';
import { hashRequest } from '../idempotency/request-hash';
import { DashboardCreatePaymentDto } from './dto/dashboard-create-payment.dto';
import { DashboardListPaymentsDto } from './dto/dashboard-list-payments.dto';
import { ModeQueryDto } from './dto/mode-query.dto';
import { toChainTxResponse } from './chain-tx.response';
import { PaymentDetailService } from './payment-detail.service';
import { toPaymentResponse } from './payment.response';
import { PaymentsService } from './payments.service';

// Same service as the /v1 controller, different door
// Only the guard and where mode comes from differ
@Controller('dashboard/payments')
@UseGuards(SessionGuard)
export class DashboardPaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly detail: PaymentDetailService,
    private readonly settlement: SettlementService,
    private readonly idempotency: IdempotencyService,
  ) {}

  // A merchant invoicing their own live books is the product, not an attack
  // Mode therefore comes off the body and is only validated
  // What stops a live payment is the address derivation, not a check here
  @Post()
  async create(
    @CurrentSession() session: AuthenticatedSession,
    @Body() dto: DashboardCreatePaymentDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    const key = requireIdempotencyKey(idempotencyKey);

    return this.idempotency.run({
      merchantId: session.merchantId,
      key,
      requestHash: hashRequest(dto),
      successStatus: 201,
      handler: async () =>
        toPaymentResponse(
          await this.payments.create(
            { merchantId: session.merchantId, mode: dto.mode, apiKeyId: null },
            dto,
          ),
        ),
    });
  }

  @Get()
  async list(
    @CurrentSession() session: AuthenticatedSession,
    @Query() query: DashboardListPaymentsDto,
  ) {
    const page = await this.payments.list(
      session.merchantId,
      query.mode,
      query,
    );

    return { data: page.data.map(toPaymentResponse), hasMore: page.hasMore };
  }

  // Everything the detail page draws, in one response
  // Four separate calls would each read at their own moment
  // A settlement between two would show pending next to a paid ledger
  @Get(':id')
  async get(
    @CurrentSession() session: AuthenticatedSession,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ModeQueryDto,
  ) {
    const detail = await this.detail.get(session.merchantId, query.mode, id);

    return {
      payment: toPaymentResponse(detail.payment),
      chainTxs: detail.chainTxs.map(toChainTxResponse),
      ledger: detail.ledger.map(toLedgerEntryResponse),
      webhooks: detail.webhooks.map(toDeliveryResponse),
    };
  }

  // Stands in for the chain, same as the /v1 one
  // Test mode only: in live the blockchain decides, not an endpoint of mine
  @Post(':id/confirm')
  @HttpCode(200)
  async confirm(
    @CurrentSession() session: AuthenticatedSession,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ModeQueryDto,
  ) {
    if (query.mode !== KeyMode.TEST) {
      throw new ForbiddenException('confirm is only available in test mode');
    }

    // The scoped read first
    // Asking for a live payment with mode=test is then a 404, not a settlement
    await this.payments.get(session.merchantId, query.mode, id);

    const { payment } = await this.settlement.settle(session.merchantId, id);

    return toPaymentResponse(payment);
  }
}
