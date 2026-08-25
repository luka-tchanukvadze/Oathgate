import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  AccountKind,
  EntryDirection,
  fiatExponent,
  type Payment,
  PaymentStatus,
  type Prisma,
  PrismaService,
} from '@app/shared';
import { AccountsService } from '../ledger/accounts.service';
import { LedgerService } from '../ledger/ledger.service';

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
