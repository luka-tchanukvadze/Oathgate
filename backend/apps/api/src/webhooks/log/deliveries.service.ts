import { InjectQueue } from '@nestjs/bullmq';
import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Queue } from 'bullmq';
import {
  type Page,
  PrismaService,
  WEBHOOK_QUEUE,
  type WebhookAttempt,
  type WebhookDelivery,
  WebhookDeliveryStatus,
} from '@app/shared';
import { DEFAULT_LIMIT, ListDeliveriesDto } from './dto/list-deliveries.dto';
import { enqueueDeliveries } from '../delivery/enqueue';
import { MAX_ATTEMPTS } from '../delivery/webhook.constants';

type DeliveryWithAttempts = WebhookDelivery & {
  webhookAttempts: WebhookAttempt[];
};

@Injectable()
export class DeliveriesService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue(WEBHOOK_QUEUE) private readonly queue: Queue,
  ) {}

  async list(
    merchantId: string,
    query: ListDeliveriesDto,
  ): Promise<Page<WebhookDelivery>> {
    const limit = query.limit ?? DEFAULT_LIMIT;

    const rows = await this.prisma.webhookDelivery.findMany({
      where: {
        merchantId,
        mode: query.mode,
        ...(query.status ? { status: query.status } : {}),
        ...(query.endpointId ? { endpointId: query.endpointId } : {}),
        // Ids are UUIDv7, so "older than the last one seen" is just "smaller"
        ...(query.startingAfter ? { id: { lt: query.startingAfter } } : {}),
      },
      orderBy: { id: 'desc' },
      // One more than asked for. If it comes back there is another page, which
      // saves running a COUNT over the whole table to find that out
      take: limit + 1,
    });

    return { data: rows.slice(0, limit), hasMore: rows.length > limit };
  }

  // No mode filter. The id is already scoped to the merchant, and the row states
  // its own mode in the response
  async get(merchantId: string, id: string): Promise<DeliveryWithAttempts> {
    const delivery = await this.prisma.webhookDelivery.findFirst({
      where: { id, merchantId },
      include: { webhookAttempts: { orderBy: { attempt: 'asc' } } },
    });

    if (!delivery) {
      throw new NotFoundException('delivery not found');
    }

    return delivery;
  }

  // Deliberately allowed on a delivery that already succeeded. "Send me that one
  // again" is a normal thing to want while wiring up a handler
  async replay(merchantId: string, id: string): Promise<WebhookDelivery> {
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
        // Raised, not reset. attempts keeps counting up so the attempt log stays
        // in order and its unique numbering holds, and this is what stops the
        // next send hitting the ceiling immediately
        maxAttempts: { increment: MAX_ATTEMPTS },
      },
    });

    // Queued here so a dashboard click is not waiting on the next sweep tick. If
    // Redis is down this throws, the row is already PENDING and due, and the
    // sweep picks it up when Redis comes back
    await enqueueDeliveries(this.queue, [replayed]);

    return replayed;
  }
}
