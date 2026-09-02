import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  AccountKind,
  EntryDirection,
  KeyMode,
  PaymentStatus,
  type Prisma,
  PrismaService,
  SettlementService,
} from '@app/shared';
import { MIN_CONFIRMATIONS } from './chain.constants';

const BATCH_SIZE = 25;

// How long a settled payment stays worth re-checking
// A block a day deep would cost more to rewrite than the chain has ever spent,
// so past this I stop asking and treat the money as final
const REVIEW_WINDOW_MS = 24 * 60 * 60_000;

interface Settled {
  id: string;
  merchantId: string;
  chainTxs: { amount: Prisma.Decimal; confirmations: number }[];
  ledgerEntries: {
    direction: EntryDirection;
    amount: Prisma.Decimal;
    account: { kind: AccountKind };
  }[];
}

@Injectable()
export class ChainReorgService {
  private readonly logger = new Logger(ChainReorgService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settlement: SettlementService,
  ) {}

  // A minute is plenty
  // Reorgs are rare, and one that matters does not stop mattering while I wait
  @Cron(CronExpression.EVERY_MINUTE)
  async sweep(): Promise<void> {
    try {
      const settled = await this.prisma.payment.findMany({
        where: {
          mode: KeyMode.TEST,
          status: PaymentStatus.PAID,
          updatedAt: { gt: new Date(Date.now() - REVIEW_WINDOW_MS) },
        },
        orderBy: { updatedAt: 'desc' },
        take: BATCH_SIZE,
        select: {
          id: true,
          merchantId: true,
          chainTxs: { select: { amount: true, confirmations: true } },
          ledgerEntries: {
            select: {
              direction: true,
              amount: true,
              account: { select: { kind: true } },
            },
          },
        },
      });

      for (const payment of settled) {
        await this.check(payment);
      }
    } catch (error) {
      this.logger.error(`reorg sweep failed: ${String(error)}`);
    }
  }

  private async check(payment: Settled): Promise<void> {
    // The watcher clears a block hash the moment a transaction leaves its
    // block, and confirmations go back to zero with it
    // So a reorg shows up here as money that stopped being confirmed
    const confirmed = payment.chainTxs
      .filter((tx) => tx.confirmations >= MIN_CONFIRMATIONS)
      .reduce((total, tx) => total + BigInt(tx.amount.toFixed(0)), 0n);

    const credited = this.credited(payment);

    if (credited <= 0n || confirmed >= credited) {
      return;
    }

    this.logger.warn(
      `${payment.id} was credited ${credited} and the chain now shows ${confirmed}`,
    );

    await this.settlement.reverse(
      payment.merchantId,
      payment.id,
      `only ${confirmed} of ${credited} still confirmed on chain`,
    );
  }

  // What this payment put in the merchant's balance, net of any reversal
  // An already reversed payment nets to zero and is skipped above
  private credited(payment: Settled): bigint {
    return payment.ledgerEntries
      .filter((entry) => entry.account.kind === AccountKind.MERCHANT_BALANCE)
      .reduce(
        (total, entry) =>
          entry.direction === EntryDirection.CREDIT
            ? total + BigInt(entry.amount.toFixed(0))
            : total - BigInt(entry.amount.toFixed(0)),
        0n,
      );
  }
}
