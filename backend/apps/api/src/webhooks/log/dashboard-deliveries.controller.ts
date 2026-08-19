import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { AuthenticatedSession } from '../../auth/auth.types';
import { CurrentSession } from '../../auth/decorators/current-session.decorator';
import { SessionGuard } from '../../auth/guards/session.guard';
import { DeliveriesService } from './deliveries.service';
import {
  toDeliveryDetailResponse,
  toDeliveryResponse,
} from './delivery.response';
import { ListDeliveriesDto } from './dto/list-deliveries.dto';

@Controller('dashboard/webhook-deliveries')
@UseGuards(SessionGuard)
export class DashboardDeliveriesController {
  constructor(private readonly deliveries: DeliveriesService) {}

  @Get()
  async list(
    @CurrentSession() session: AuthenticatedSession,
    @Query() query: ListDeliveriesDto,
  ) {
    const page = await this.deliveries.list(session.merchantId, query);

    return { data: page.data.map(toDeliveryResponse), hasMore: page.hasMore };
  }

  @Get(':id')
  async get(
    @CurrentSession() session: AuthenticatedSession,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const delivery = await this.deliveries.get(session.merchantId, id);

    return toDeliveryDetailResponse(delivery);
  }

  // 202, not 200. The row is queued when this returns, not delivered, and saying
  // 200 would claim something I do not know yet
  @Post(':id/replay')
  @HttpCode(HttpStatus.ACCEPTED)
  async replay(
    @CurrentSession() session: AuthenticatedSession,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    const delivery = await this.deliveries.replay(session.merchantId, id);

    return toDeliveryResponse(delivery);
  }
}
