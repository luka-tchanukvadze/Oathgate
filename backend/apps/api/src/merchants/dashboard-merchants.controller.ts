import { Controller, Get, NotFoundException, UseGuards } from '@nestjs/common';
import { PrismaService } from '@app/shared';
import type { AuthenticatedSession } from '../auth/auth.types';
import { CurrentSession } from '../auth/decorators/current-session.decorator';
import { SessionGuard } from '../auth/guards/session.guard';
import { toMerchantResponse } from './merchant.response';

// Who you are, as opposed to dashboard/auth/me which answers which session
// this is. The header needs a name and an email, and a session row has neither
@Controller('dashboard/me')
@UseGuards(SessionGuard)
export class DashboardMerchantsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async me(@CurrentSession() session: AuthenticatedSession) {
    const merchant = await this.prisma.merchant.findUnique({
      where: { id: session.merchantId },
    });

    // A live session whose merchant is gone is a deleted sandbox, not an error
    // worth a 500
    if (!merchant) {
      throw new NotFoundException('merchant not found');
    }

    return toMerchantResponse(merchant);
  }
}
