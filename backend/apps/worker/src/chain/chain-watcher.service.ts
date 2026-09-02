import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { KeyMode, PaymentStatus, PrismaService } from '@app/shared';
import { BlockstreamClient } from './blockstream.client';
import { ADDRESS_TX_PAGE } from './chain.constants';
import type { ChainTransaction } from './chain.types';

// One sweep asks the explorer once per address, so this is also the request
// budget: 25 addresses plus one tip lookup every 30 seconds
const BATCH_SIZE = 25;

// How long after expiry I keep looking
// Settling a late payment is still an open question, but seeing the money is
// not, and an observation I never record is one I can never go back for
const LATE_WINDOW_MS = 60 * 60_000;

@Injectable()
export class ChainWatcherService {
  private readonly logger = new Logger(ChainWatcherService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly chain: BlockstreamClient,
  ) {}

  @Cron(CronExpression.EVERY_30_SECONDS)
  async sweep(): Promise<void> {
    try {
      const watched = await this.watchedPayments();

      if (watched.length === 0) {
        return;
      }

      // Once per sweep, not once per payment
      // 25 payments would otherwise be 50 requests instead of 26
      const tip = await this.chain.tipHeight();

      let seen = 0;

      for (const payment of watched) {
        // One address failing cannot end the sweep for the other 24
        try {
          seen += await this.check(payment, tip);
        } catch (error) {
          this.logger.warn(
            `could not check ${payment.address}: ${String(error)}`,
          );
        }
      }

      if (seen > 0) {
        this.logger.log(`recorded ${seen} chain transactions`);
      }

      // Proof of life, because a quiet sweep and a broken one look identical
      // Without this I cannot tell nothing arrived from nothing is polling
      this.logger.debug(`polled ${watched.length} addresses at tip ${tip}`);
    } catch (error) {
      this.logger.error(`chain sweep failed: ${String(error)}`);
    }
  }

  // Only what can still change
  // A paid payment needs no polling, nor one that expired last week
  private async watchedPayments() {
    const lateWindow = new Date(Date.now() - LATE_WINDOW_MS);

    return this.prisma.payment.findMany({
      where: {
        // The client points at one network
        // A live address is bc1 and this explorer would answer about nothing
        mode: KeyMode.TEST,
        OR: [
          {
            status: {
              in: [PaymentStatus.PENDING, PaymentStatus.CONFIRMING],
            },
          },
          { status: PaymentStatus.EXPIRED, expiresAt: { gt: lateWindow } },
        ],
      },
      orderBy: { createdAt: 'asc' },
      take: BATCH_SIZE,
      select: { id: true, address: true, cryptoCurrency: true },
    });
  }

  private async check(
    payment: { id: string; address: string; cryptoCurrency: string },
    tip: number,
  ): Promise<number> {
    const transactions = await this.chain.addressTransactions(payment.address);

    let written = 0;

    for (const transaction of transactions) {
      written += await this.record(payment, transaction, tip);
    }

    await this.reconcile(
      payment.id,
      transactions.map((transaction) => transaction.txid),
    );

    return written;
  }

  // What the explorer returns is the whole truth, not an addition to what I had
  // A sender can replace an unconfirmed transaction with one paying more fee,
  // which is a different txid, so the unique index never sees a duplicate
  // The replaced one vanishes from the explorer and must vanish from here too,
  // or the sum counts money that will never arrive
  private async reconcile(paymentId: string, seen: string[]): Promise<void> {
    // A short page means I saw everything at this address
    // At the cap I am looking at part of the picture, and a transaction being
    // absent stops meaning it is gone
    if (seen.length >= ADDRESS_TX_PAGE) {
      return;
    }

    const { count: dropped } = await this.prisma.chainTx.deleteMany({
      where: { paymentId, blockHash: null, txid: { notIn: seen } },
    });

    // One that was in a block and is not in the answer any more
    // Its block lost, and the transaction did not survive into the new chain,
    // so it is unconfirmed again and may never confirm at all
    // The row stays, because the money is the reorg sweep's business, not mine
    const { count: orphaned } = await this.prisma.chainTx.updateMany({
      where: { paymentId, blockHash: { not: null }, txid: { notIn: seen } },
      data: { blockHash: null, confirmations: 0 },
    });

    if (dropped > 0) {
      this.logger.log(`dropped ${dropped} replaced transactions`);
    }

    if (orphaned > 0) {
      this.logger.warn(`${orphaned} confirmed transactions left their block`);
    }
  }

  // Upsert, because the same transaction comes back on every poll
  // A second sighting must not add a row, and its confirmations still climb
  private async record(
    payment: { id: string; cryptoCurrency: string },
    transaction: ChainTransaction,
    tip: number,
  ): Promise<number> {
    // A transaction in the block at the tip has one confirmation, not zero
    const confirmations =
      transaction.blockHeight === null
        ? 0
        : Math.max(0, tip - transaction.blockHeight + 1);

    const existing = await this.prisma.chainTx.findUnique({
      where: {
        txid_paymentId: { txid: transaction.txid, paymentId: payment.id },
      },
      select: { id: true },
    });

    await this.prisma.chainTx.upsert({
      where: {
        txid_paymentId: { txid: transaction.txid, paymentId: payment.id },
      },
      create: {
        paymentId: payment.id,
        txid: transaction.txid,
        blockHash: transaction.blockHash,
        amount: transaction.amount.toString(),
        currency: payment.cryptoCurrency,
        confirmations,
      },
      // Amount is not here, and that is the point
      // A txid commits to its own outputs, so an amount that changed would mean
      // I am looking at a different transaction wearing the same name
      update: {
        blockHash: transaction.blockHash,
        confirmations,
      },
    });

    if (!existing) {
      this.logger.log(
        `saw ${transaction.amount} ${payment.cryptoCurrency} for ${payment.id} in ${transaction.txid.slice(0, 12)}`,
      );

      return 1;
    }

    return 0;
  }
}
