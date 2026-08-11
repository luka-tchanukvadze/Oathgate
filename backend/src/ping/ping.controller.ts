import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from '../auth/api-key.guard';
import { CurrentMerchant } from '../auth/current-merchant.decorator';
import type { AuthenticatedMerchant } from '../auth/authenticated-merchant';

@Controller('v1/ping')
@UseGuards(ApiKeyGuard)
export class PingController {
  @Get()
  ping(@CurrentMerchant() merchant: AuthenticatedMerchant) {
    return { merchantId: merchant.merchantId, mode: merchant.mode };
  }
}
