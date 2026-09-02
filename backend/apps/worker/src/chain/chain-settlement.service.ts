import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  KeyMode,
  PaymentStatus,
  type Prisma,
  PrismaService,
  SettlementService,
} from '@app/shared';
import { MIN_CONFIRMATIONS } from './chain.constants';

const BATCH_SIZE = 25;

// How long past expiry I wait before calling a short payment underpaid
// Before the window closes, not enough yet and not enough ever look the same,
// and coins can still be sitting unconfirmed when the clock runs out
// Matches the watcher's late window, so it is still polling for this whole time
const UNDERPAID_AFTER_MS = 60 * 60_000;

// The shape the query below selects, named rather than written inline
// Decimal is Prisma's own type and not a number, which is the whole point
interface Candidate {
  id: string;
  merchantId: string;
  status: PaymentStatus;
  cryptoAmount: Prisma.Decimal;
  expiresAt: Date;
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
          expiresAt: true,
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

    if (settled < owed) {
      const giveUpAt = payment.expiresAt.getTime() + UNDERPAID_AFTER_MS;

      // Short, and out of time to stop being short
      if (Date.now() > giveUpAt) {
        await this.markUnderpaid(payment.id, settled, owed);

        return;
      }

      // Seen but not buried yet
      // The customer gets to watch it move rather than staring at PENDING
      await this.markConfirming(payment.id, payment.status);

      return;
    }

    try {
      // settled, not owed
      // I hold what arrived, so that is what the books have to say I hold
      const result = await this.settlement.settle(
        payment.merchantId,
        payment.id,
        settled,
      );

      if (!result.alreadySettled) {
        const over = settled - owed;

        this.logger.log(
          over > 0n
            ? `settled ${payment.id} with ${settled}, ${over} over`
            : `settled ${payment.id} with ${settled}`,
        );
      }
    } catch (error) {
      this.logger.error(`could not settle ${payment.id}: ${String(error)}`);
    }
  }

  // A terminal state, so the guard is the status and not a timestamp
  // Money is still at that address and still mine to sweep, this only says the
  // invoice will not be settling itself
  private async markUnderpaid(
    paymentId: string,
    settled: bigint,
    owed: bigint,
  ): Promise<void> {
    const { count } = await this.prisma.payment.updateMany({
      where: {
        id: paymentId,
        status: { in: [PaymentStatus.PENDING, PaymentStatus.CONFIRMING] },
      },
      data: { status: PaymentStatus.UNDERPAID },
    });

    if (count > 0) {
      this.logger.warn(
        `${paymentId} is underpaid, ${settled} of ${owed} arrived`,
      );
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
