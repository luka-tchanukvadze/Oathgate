import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedSession } from '../../auth/auth.types';
import { CurrentSession } from '../../auth/decorators/current-session.decorator';
import { SessionGuard } from '../../auth/guards/session.guard';
import { ModeQueryDto } from '../../payments/dto/mode-query.dto';
import { CreateEndpointDto } from './dto/create-endpoint.dto';
import { toEndpointResponse } from './webhook.response';
import { WebhooksService } from './webhooks.service';

// Dashboard only
// A merchant's server does not choose where its own notifications go
// That is a decision a human makes
@Controller('dashboard/webhook-endpoints')
@UseGuards(SessionGuard)
export class DashboardWebhooksController {
  constructor(private readonly webhooks: WebhooksService) {}

  @Post()
  async create(
    @CurrentSession() session: AuthenticatedSession,
    @Body() dto: CreateEndpointDto,
  ) {
    const { endpoint, secret } = await this.webhooks.create(
      session.merchantId,
      dto,
    );

    // The only response that ever carries the plain secret
    return { ...toEndpointResponse(endpoint), secret };
  }

  @Get()
  async list(
    @CurrentSession() session: AuthenticatedSession,
    @Query() query: ModeQueryDto,
  ) {
    const endpoints = await this.webhooks.list(session.merchantId, query.mode);

    return { data: endpoints.map(toEndpointResponse) };
  }

  // DELETE, but it disables rather than removes
  // The verb matches what the merchant means, and deliveries point here
  @Delete(':id')
  async disable(
    @CurrentSession() session: AuthenticatedSession,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const endpoint = await this.webhooks.disable(session.merchantId, id);

    return toEndpointResponse(endpoint);
  }
}
