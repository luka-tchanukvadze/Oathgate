import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedSession } from '../auth/auth.types';
import { CurrentSession } from '../auth/decorators/current-session.decorator';
import { SessionGuard } from '../auth/guards/session.guard';
import { DashboardListPaymentsDto } from './dto/dashboard-list-payments.dto';
import { ModeQueryDto } from './dto/mode-query.dto';
import { toPaymentResponse } from './payment.response';
import { PaymentsService } from './payments.service';

// Same service as the /v1 controller, different door
// Only the guard and where mode comes from differ
@Controller('dashboard/payments')
@UseGuards(SessionGuard)
export class DashboardPaymentsController {
  constructor(private readonly payments: PaymentsService) {}

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
}
