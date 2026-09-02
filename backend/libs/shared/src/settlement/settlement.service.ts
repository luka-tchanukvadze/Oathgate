import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  AccountKind,
  EntryDirection,
  type Payment,
  PaymentStatus,
  type Prisma,
} from '../generated/prisma/client';
import { AccountsService } from '../ledger/accounts.service';
import { LedgerService } from '../ledger/ledger.service';
import { fiatExponent } from '../money/currencies';
import { PrismaService } from '../prisma/prisma.service';

type Tx = Prisma.TransactionClient;

// Anything else is already done or has nowhere to go
// Whether a late payment on an expired quote settles is still open
// So it refuses loudly rather than guessing
const SETTLEABLE: PaymentStatus[] = [
  PaymentStatus.PENDING,
  PaymentStatus.CONFIRMING,
];

export interface SettleResult {
  payment: Payment;
  alreadySettled: boolean;
}

export interface ReverseResult {
  payment: Payment;
  reversed: boolean;
}

@Injectable()
export class SettlementService {
  private readonly logger = new Logger(SettlementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly accounts: AccountsService,
  ) {}

  // received is what actually landed on the chain, which is not always what I
  // asked for
  // Left out, it falls back to the invoice, which is what the test endpoint
  // wants because no coins moved at all
  async settle(
    merchantId: string,
    paymentId: string,
    received?: bigint,
  ): Promise<SettleResult> {
    return this.prisma.$transaction(async (tx) => {
      const payment = await this.lockPayment(tx, merchantId, paymentId);

      // Written inside this transaction the first time round
      // A retry can only see it once the money has actually landed
      if (payment.status === PaymentStatus.PAID) {
        return { payment, alreadySettled: true };
      }

      if (!SETTLEABLE.includes(payment.status)) {
        throw new ConflictException(
          `payment is ${payment.status} and cannot be settled`,
        );
      }

      const owed = BigInt(payment.cryptoAmount.toFixed(0));
      const amount = received ?? owed;

      // The books say what arrived, not what I hoped would
      // Crediting the invoice while holding more makes the reconciliation job
      // report drift on every overpaid invoice, and an alarm that cries wolf
      // daily is worse than none
      if (amount < owed) {
        throw new ConflictException(
          `${amount} received does not cover ${owed} owed`,
        );
      }

      const wallet = await this.accounts.house(
        tx,
        AccountKind.GATEWAY_WALLET,
        payment.cryptoCurrency,
        payment.mode,
      );

      const balance = await this.accounts.merchantBalance(
        tx,
        merchantId,
        payment.cryptoCurrency,
        payment.mode,
      );

      // Coins arrive in my wallet, and I now owe the shop the same amount
      await this.ledger.post(tx, {
        currency: payment.cryptoCurrency,
        paymentId,
        legs: [
          {
            accountId: wallet.id,
            kind: AccountKind.GATEWAY_WALLET,
            direction: EntryDirection.DEBIT,
            amount,
          },
          {
            accountId: balance.id,
            kind: AccountKind.MERCHANT_BALANCE,
            direction: EntryDirection.CREDIT,
            amount,
          },
        ],
      });

      // Read here so the event can carry it
      // Notifications has its own database and cannot join to mine
      const merchant = await tx.merchant.findUniqueOrThrow({
        where: { id: merchantId },
        select: { email: true, name: true },
      });

      const settled = await tx.payment.update({
        where: { id: paymentId },
        data: { status: PaymentStatus.PAID },
      });

      // Written rather than published
      // A crash between committing the money and announcing it loses nothing
      await tx.outboxEvent.create({
        data: {
          aggregateType: 'payment',
          aggregateId: paymentId,
          merchantId,
          mode: payment.mode,
          eventType: 'payment.completed',
          payload: {
            paymentId,
            merchantId,
            mode: payment.mode,
            merchantEmail: merchant.email,
            merchantName: merchant.name,
            cryptoAmount: amount.toString(),
            cryptoCurrency: payment.cryptoCurrency,
            fiatAmount: payment.fiatAmount.toFixed(0),
            fiatCurrency: payment.fiatCurrency,
            // The exponent travels too, so 1050 with 2 is unambiguous
            // Otherwise a consumer assumes every currency has two decimals
            fiatExponent: fiatExponent(payment.fiatCurrency),
          },
        },
      });

      this.logger.log(
        `settled ${paymentId} for ${amount} ${payment.cryptoCurrency}`,
      );

      return { payment: settled, alreadySettled: false };
    });
  }

  // Locked first, and always first
  // Two paths taking the same locks in opposite orders is a deadlock
  // A settled payment whose money left the chain again
  // Nothing here updates or deletes a row: undoing a transfer means writing the
  // opposite one and letting the pair sum to nothing
  async reverse(
    merchantId: string,
    paymentId: string,
    reason: string,
  ): Promise<ReverseResult> {
    return this.prisma.$transaction(async (tx) => {
      const payment = await this.lockPayment(tx, merchantId, paymentId);

      if (payment.status !== PaymentStatus.PAID) {
        return { payment, reversed: false };
      }

      // Only what has not been undone already
      // reversesId is unique, so a second attempt would fail the insert anyway,
      // and this turns that into a quiet no-op instead of an error
      const original = await tx.ledgerEntry.findMany({
        where: { paymentId, reversedBy: null },
        select: {
          id: true,
          accountId: true,
          direction: true,
          amount: true,
          account: { select: { kind: true } },
        },
      });

      if (original.length === 0) {
        return { payment, reversed: false };
      }

      // Every entry mirrored, each pointing at the one it undoes
      // The pair balanced before, so the mirror of the pair balances too
      await this.ledger.post(tx, {
        currency: payment.cryptoCurrency,
        paymentId,
        legs: original.map((entry) => ({
          accountId: entry.accountId,
          kind: entry.account.kind,
          direction:
            entry.direction === EntryDirection.CREDIT
              ? EntryDirection.DEBIT
              : EntryDirection.CREDIT,
          amount: BigInt(entry.amount.toFixed(0)),
          reversesId: entry.id,
        })),
      });

      const taken = original
        .filter(
          (entry) =>
            entry.account.kind === AccountKind.MERCHANT_BALANCE &&
            entry.direction === EntryDirection.CREDIT,
        )
        .reduce((total, entry) => total + BigInt(entry.amount.toFixed(0)), 0n);

      const merchant = await tx.merchant.findUniqueOrThrow({
        where: { id: merchantId },
        select: { email: true, name: true },
      });

      const reversed = await tx.payment.update({
        where: { id: paymentId },
        data: { status: PaymentStatus.REVERSED },
      });

      // A merchant who was told they were paid has to be told they were not
      await tx.outboxEvent.create({
        data: {
          aggregateType: 'payment',
          aggregateId: paymentId,
          merchantId,
          mode: payment.mode,
          eventType: 'payment.reversed',
          payload: {
            paymentId,
            merchantId,
            mode: payment.mode,
            reason,
            merchantEmail: merchant.email,
            merchantName: merchant.name,
            cryptoAmount: taken.toString(),
            cryptoCurrency: payment.cryptoCurrency,
            fiatAmount: payment.fiatAmount.toFixed(0),
            fiatCurrency: payment.fiatCurrency,
            fiatExponent: fiatExponent(payment.fiatCurrency),
          },
        },
      });

      this.logger.warn(`reversed ${paymentId} taking back ${taken}: ${reason}`);

      return { payment: reversed, reversed: true };
    });
  }

  private async lockPayment(
    tx: Tx,
    merchantId: string,
    paymentId: string,
  ): Promise<Payment> {
    const rows = await tx.$queryRaw<Payment[]>`
      SELECT * FROM payment
      WHERE id = ${paymentId}::uuid AND "merchantId" = ${merchantId}::uuid
      FOR UPDATE
    `;

    const payment = rows[0];

    if (!payment) {
      throw new NotFoundException('payment not found');
    }

    return payment;
  }
}
