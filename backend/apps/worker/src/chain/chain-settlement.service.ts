import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  KeyMode,
  PaymentStatus,
  type Prisma,
  PrismaService,
  SettlementService,
} from '@app/shared';

const BATCH_SIZE = 25;

// How many blocks have to sit on top before I call it paid
// A confirmation is not a second opinion, it is a price: reversing this now
// means rebuilding that many blocks faster than everyone else put together
// One is already far more than a coffee is worth stealing, and waiting six
// means an hour of a customer standing at a counter
const MIN_CONFIRMATIONS = 1;

// The shape the query below selects, named rather than written inline
// Decimal is Prisma's own type and not a number, which is the whole point
interface Candidate {
  id: string;
  merchantId: string;
  status: PaymentStatus;
  cryptoAmount: Prisma.Decimal;
  chainTxs: { amount: Prisma.Decimal; confirmations: number }[];
}

@Injectable()
export class ChainSettlementService {
  private readonly logger = new Logger(ChainSettlementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settlement: SettlementService,
  ) {}

  // Separate from the watcher on purpose
  // One service decides what is true, this one decides what to do about it
  @Cron(CronExpression.EVERY_30_SECONDS)
  async sweep(): Promise<void> {
    try {
      const candidates = await this.prisma.payment.findMany({
        where: {
          mode: KeyMode.TEST,
          status: {
            in: [PaymentStatus.PENDING, PaymentStatus.CONFIRMING],
          },
          chainTxs: { some: {} },
        },
        orderBy: { createdAt: 'asc' },
        take: BATCH_SIZE,
        select: {
          id: true,
          merchantId: true,
          status: true,
          cryptoAmount: true,
          chainTxs: { select: { amount: true, confirmations: true } },
        },
      });

      if (candidates.length === 0) {
        return;
      }

      // Same reason as the watcher, a quiet sweep and a broken one look alike
      this.logger.debug(`weighing ${candidates.length} payments`);

      for (const payment of candidates) {
        await this.decide(payment);
      }
    } catch (error) {
      this.logger.error(`settlement sweep failed: ${String(error)}`);
    }
  }

  private async decide(payment: Candidate): Promise<void> {
    const owed = BigInt(payment.cryptoAmount.toFixed(0));

    // Only what is buried deep enough counts
    // A transaction still in the mempool can be replaced or dropped
    const settled = payment.chainTxs
      .filter((tx) => tx.confirmations >= MIN_CONFIRMATIONS)
      .reduce((total, tx) => total + BigInt(tx.amount.toFixed(0)), 0n);

    // Seen but not buried yet
    // The customer gets to watch it move rather than staring at PENDING
    if (settled < owed) {
      await this.markConfirming(payment.id, payment.status);

      return;
    }

    try {
      const result = await this.settlement.settle(
        payment.merchantId,
        payment.id,
      );

      if (!result.alreadySettled) {
        this.logger.log(`settled ${payment.id} with ${settled} confirmed`);
      }
    } catch (error) {
      this.logger.error(`could not settle ${payment.id}: ${String(error)}`);
    }
  }

  // Only forward, and only once
  // The status column is the same row settle takes a lock on, so writing it
  // from here on every sweep would fight that lock for nothing
  private async markConfirming(
    paymentId: string,
    current: PaymentStatus,
  ): Promise<void> {
    if (current === PaymentStatus.CONFIRMING) {
      return;
    }

    await this.prisma.payment.updateMany({
      where: { id: paymentId, status: PaymentStatus.PENDING },
      data: { status: PaymentStatus.CONFIRMING },
    });

    this.logger.log(`${paymentId} is confirming`);
  }
}
