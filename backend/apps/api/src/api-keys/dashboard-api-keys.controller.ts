import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedSession } from '../auth/auth.types';
import { CurrentSession } from '../auth/decorators/current-session.decorator';
import { SessionGuard } from '../auth/guards/session.guard';
import { toApiKeyResponse } from './api-key.response';
import { ApiKeysService } from './api-keys.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

// Dashboard only, and there is no key-authenticated version of this on purpose
// A key that can mint another key is a key that cannot be revoked
@Controller('dashboard/api-keys')
@UseGuards(SessionGuard)
export class DashboardApiKeysController {
  constructor(private readonly keys: ApiKeysService) {}

  @Get()
  async list(@CurrentSession() session: AuthenticatedSession) {
    const keys = await this.keys.list(session.merchantId);

    return { data: keys.map(toApiKeyResponse) };
  }

  @Post()
  async create(
    @CurrentSession() session: AuthenticatedSession,
    @Body() dto: CreateApiKeyDto,
  ) {
    const { key, secret } = await this.keys.create(session.merchantId, dto);

    // The only response that ever carries the plain key
    return { ...toApiKeyResponse(key), secret };
  }

  // POST, not DELETE, because the row survives. The verb matches what happens
  @Post(':id/revoke')
  @HttpCode(200)
  async revoke(
    @CurrentSession() session: AuthenticatedSession,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return toApiKeyResponse(await this.keys.revoke(session.merchantId, id));
  }
}
