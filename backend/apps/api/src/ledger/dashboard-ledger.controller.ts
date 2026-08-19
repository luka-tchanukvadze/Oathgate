import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import type { AuthenticatedSession } from '../auth/auth.types';
import { CurrentSession } from '../auth/decorators/current-session.decorator';
import { SessionGuard } from '../auth/guards/session.guard';
import { ListEntriesDto } from './dto/list-entries.dto';
import { LedgerQueryService } from './ledger-query.service';
import { toBalanceResponse, toLedgerEntryResponse } from './ledger.response';

@Controller('dashboard')
@UseGuards(SessionGuard)
export class DashboardLedgerController {
  constructor(private readonly ledger: LedgerQueryService) {}

  @Get('balances')
  async balances(
    @CurrentSession() session: AuthenticatedSession,
    @Query() query: ListEntriesDto,
  ) {
    const accounts = await this.ledger.balances(session.merchantId, query.mode);

    return { data: accounts.map(toBalanceResponse) };
  }

  @Get('ledger')
  async entries(
    @CurrentSession() session: AuthenticatedSession,
    @Query() query: ListEntriesDto,
  ) {
    const page = await this.ledger.entries(session.merchantId, query);

    return {
      data: page.data.map(toLedgerEntryResponse),
      hasMore: page.hasMore,
    };
  }
}
