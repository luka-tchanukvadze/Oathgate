import { Injectable, NotFoundException } from '@nestjs/common';
import {
  type ChainTx,
  type KeyMode,
  type LedgerEntry,
  type Payment,
  Prisma,
  PrismaService,
  type WebhookDelivery,
} from '@app/shared';

// What settlement writes on the outbox row
// The only way back from a delivery to the payment that caused it
const PAYMENT_AGGREGATE = 'payment';

export interface PaymentDetail {
  payment: Payment;
  chainTxs: ChainTx[];
  ledger: LedgerEntry[];
  webhooks: WebhookDelivery[];
}

@Injectable()
export class PaymentDetailService {
  constructor(private readonly prisma: PrismaService) {}

  // Repeatable read, so both queries see one version of the database
  // Read committed would let the worker settle between them
  // The page would then show a pending payment that already paid the merchant
  async get(
    merchantId: string,
    mode: KeyMode,
    id: string,
  ): Promise<PaymentDetail> {
    return this.prisma.$transaction(
      async (tx) => {
        const payment = await tx.payment.findFirst({
          // mode as well as merchant, or the test toggle opens live money
          where: { id, merchantId, mode },
          include: {
            chainTxs: { orderBy: { seenAt: 'asc' } },
            ledgerEntries: { orderBy: { createdAt: 'asc' } },
          },
        });

        if (!payment) {
          throw new NotFoundException('payment not found');
        }

        // A delivery has no paymentId of its own
        // It names the outbox event, and the event names the payment
        // So the filter has to go through the relation
        const webhooks = await tx.webhookDelivery.findMany({
          where: {
            merchantId,
            outboxEvent: {
              aggregateType: PAYMENT_AGGREGATE,
              aggregateId: id,
            },
          },
          orderBy: { createdAt: 'asc' },
        });

        const { chainTxs, ledgerEntries, ...rest } = payment;

        return { payment: rest, chainTxs, ledger: ledgerEntries, webhooks };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }
}
