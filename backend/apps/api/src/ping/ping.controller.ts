import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { CurrentMerchant } from '../auth/decorators/current-merchant.decorator';
import type { AuthenticatedMerchant } from '../auth/auth.types';

@Controller('v1/ping')
@UseGuards(ApiKeyGuard)
export class PingController {
  @Get()
  ping(@CurrentMerchant() merchant: AuthenticatedMerchant) {
    return { merchantId: merchant.merchantId, mode: merchant.mode };
  }
}
