import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  AccountKind,
  EntryDirection,
  PaymentStatus,
  type Payment,
  type Prisma,
} from '../generated/prisma/client';
import { AccountsService } from '../ledger/accounts.service';
import { LedgerService } from '../ledger/ledger.service';
import { PrismaService } from '../prisma/prisma.service';

type Tx = Prisma.TransactionClient;

// Anything else is either already done or a dead end. Whether a late payment
// against an expired quote should settle is still an open question, so for now
// it refuses loudly rather than guessing
const SETTLEABLE: PaymentStatus[] = [
  PaymentStatus.PENDING,
  PaymentStatus.CONFIRMING,
];

export interface SettleResult {
  payment: Payment;
  alreadySettled: boolean;
}

@Injectable()
export class SettlementService {
  private readonly logger = new Logger(SettlementService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ledger: LedgerService,
    private readonly accounts: AccountsService,
  ) {}

  async settle(merchantId: string, paymentId: string): Promise<SettleResult> {
    return this.prisma.$transaction(async (tx) => {
      const payment = await this.lockPayment(tx, merchantId, paymentId);

      // Written inside this same transaction the first time round, so a retry
      // can only ever see it once the money has actually landed
      if (payment.status === PaymentStatus.PAID) {
        return { payment, alreadySettled: true };
      }

      if (!SETTLEABLE.includes(payment.status)) {
        throw new ConflictException(
          `payment is ${payment.status} and cannot be settled`,
        );
      }

      const amount = BigInt(payment.cryptoAmount.toFixed(0));

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

      const settled = await tx.payment.update({
        where: { id: paymentId },
        data: { status: PaymentStatus.PAID },
      });

      // Written rather than published. A crash between committing the money and
      // announcing it would otherwise lose the event for good
      await tx.outboxEvent.create({
        data: {
          aggregateType: 'payment',
          aggregateId: paymentId,
          eventType: 'payment.completed',
          payload: {
            paymentId,
            merchantId,
            mode: payment.mode,
            cryptoAmount: amount.toString(),
            cryptoCurrency: payment.cryptoCurrency,
          },
        },
      });

      this.logger.log(
        `settled ${paymentId} for ${amount} ${payment.cryptoCurrency}`,
      );

      return { payment: settled, alreadySettled: false };
    });
  }

  // Locked first, and always first. Two code paths taking the same pair of
  // locks in opposite orders is how a deadlock happens
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
