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
import { requireIdempotencyKey } from '../idempotency/idempotency-key';
import { IdempotencyService } from '../idempotency/idempotency.service';
import { hashRequest } from '../idempotency/request-hash';
import { DashboardCreatePaymentDto } from './dto/dashboard-create-payment.dto';
import { DashboardListPaymentsDto } from './dto/dashboard-list-payments.dto';
import { ModeQueryDto } from './dto/mode-query.dto';
import { toPaymentResponse } from './payment.response';
import { PaymentsService } from './payments.service';

// Same service as the /v1 controller, different door
// Only the guard and where mode comes from differ
@Controller('dashboard/payments')
@UseGuards(SessionGuard)
export class DashboardPaymentsController {
  constructor(
    private readonly payments: PaymentsService,
    private readonly settlement: SettlementService,
    private readonly idempotency: IdempotencyService,
  ) {}

  // A merchant creating an invoice in their own live books is the product, not
  // an attack, so mode is taken from the body and only validated
  // What actually stops a live payment here is that deriving its address needs
  // a live xpub, and an unset one throws
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

  @Get(':id')
  async get(
    @CurrentSession() session: AuthenticatedSession,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: ModeQueryDto,
  ) {
    const payment = await this.payments.get(session.merchantId, query.mode, id);

    return toPaymentResponse(payment);
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

    // The scoped read first, so asking for a live payment with mode=test is a
    // 404 rather than a confirmed payment
    await this.payments.get(session.merchantId, query.mode, id);

    const { payment } = await this.settlement.settle(session.merchantId, id);

    return toPaymentResponse(payment);
  }
}
