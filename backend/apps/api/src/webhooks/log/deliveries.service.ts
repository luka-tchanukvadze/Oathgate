import { InjectQueue } from '@nestjs/bullmq';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  enqueueDeliveries,
  MAX_ATTEMPTS,
  type Page,
  PrismaService,
  WEBHOOK_QUEUE,
  WebhookDeliveryStatus,
} from '@app/shared';
import { type DeliveryDetail, type DeliveryWithEvent } from './delivery.types';
import { DEFAULT_LIMIT, ListDeliveriesDto } from './dto/list-deliveries.dto';

@Injectable()
export class DeliveriesService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(WEBHOOK_QUEUE) private readonly queue: Queue,
  ) {}

  async list(
    merchantId: string,
    query: ListDeliveriesDto,
  ): Promise<Page<DeliveryWithEvent>> {
    const limit = query.limit ?? DEFAULT_LIMIT;

    const rows = await this.prisma.webhookDelivery.findMany({
      where: {
        merchantId,
        mode: query.mode,
        ...(query.status ? { status: query.status } : {}),
        ...(query.endpointId ? { endpointId: query.endpointId } : {}),
        // Ids are UUIDv7, which sort by time, so older is just smaller
        ...(query.startingAfter ? { id: { lt: query.startingAfter } } : {}),
      },
      orderBy: { id: 'desc' },
      // One row more than asked for
      // If it comes back there is another page, and no COUNT was needed
      take: limit + 1,
      include: {
        outboxEvent: { select: { aggregateType: true, aggregateId: true } },
      },
    });

    return { data: rows.slice(0, limit), hasMore: rows.length > limit };
  }

  // No mode filter
  // The id is already scoped to the merchant, and the row states its mode
  async get(merchantId: string, id: string): Promise<DeliveryDetail> {
    const delivery = await this.prisma.webhookDelivery.findFirst({
      where: { id, merchantId },
      include: {
        webhookAttempts: { orderBy: { attempt: 'asc' } },
        outboxEvent: { select: { aggregateType: true, aggregateId: true } },
      },
    });

    if (!delivery) {
      throw new NotFoundException('delivery not found');
    }

    return delivery;
  }

  // Allowed even on a delivery that already succeeded
  // Send me that one again is a normal thing to want while wiring up
  async replay(merchantId: string, id: string): Promise<DeliveryWithEvent> {
    const delivery = await this.prisma.webhookDelivery.findFirst({
      where: { id, merchantId },
      include: { endpoint: { select: { disabledAt: true } } },
    });

    if (!delivery) {
      throw new NotFoundException('delivery not found');
    }

    if (delivery.endpoint.disabledAt) {
      throw new ConflictException('that endpoint is disabled');
    }

    const replayed = await this.prisma.webhookDelivery.update({
      where: { id },
      data: {
        status: WebhookDeliveryStatus.PENDING,
        nextAttemptAt: new Date(),
        // Raised, not reset
        // attempts keeps climbing so the log stays one unbroken 1, 2, 3
        // Resetting it would collide with the attempt rows already there
        maxAttempts: { increment: MAX_ATTEMPTS },
      },
      include: {
        outboxEvent: { select: { aggregateType: true, aggregateId: true } },
      },
    });

    // Queued here so a dashboard click is not waiting on the next sweep
    // If Redis is down the row is already PENDING and due anyway
    await enqueueDeliveries(this.queue, [replayed]);

    return replayed;
  }
}
