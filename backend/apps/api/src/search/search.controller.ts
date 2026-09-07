import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { AuthenticatedSession } from '../auth/auth.types';
import { CurrentSession } from '../auth/decorators/current-session.decorator';
import { SessionGuard } from '../auth/guards/session.guard';
import { toPaymentResponse } from '../payments/payment.response';
import { AiAvailabilityService } from './ai-availability.service';
import { PaymentSearchService } from './payment-search.service';
import { SearchPaymentsDto } from './search-payments.dto';

@Controller('dashboard/search')
@UseGuards(SessionGuard)
export class SearchController {
  constructor(
    private readonly search: PaymentSearchService,
    private readonly availability: AiAvailabilityService,
  ) {}

  // Whether to draw the mark in the search box, and nothing more
  // The dashboard holds this for a minute rather than asking on every keypress
  @Get('availability')
  status(): { ai: boolean } {
    return { ai: this.availability.isAvailable() };
  }

  // Session scoped, so the merchant whose payments these are comes off the
  // cookie and is never something a caller or a model can name
  //
  // Tighter than the sixty a minute everything else gets, because a search can
  // spend a call on a provider whose free tier allows thirty
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Get('payments')
  async payments(
    @CurrentSession() session: AuthenticatedSession,
    @Query() query: SearchPaymentsDto,
  ) {
    const outcome = await this.search.search(
      session.merchantId,
      query.mode,
      query.q,
    );

    return {
      data: outcome.payments.map(toPaymentResponse),
      interpretation: outcome.interpretation,
      usedAi: outcome.usedAi,
      truncated: outcome.truncated,
    };
  }
}
