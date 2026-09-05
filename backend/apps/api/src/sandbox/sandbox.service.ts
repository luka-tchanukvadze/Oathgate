import { randomBytes, randomUUID } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import * as argon2 from 'argon2';
import {
  AccountKind,
  KeyMode,
  PaymentStatus,
  PrismaService,
  SecretCipher,
  SettlementService,
} from '@app/shared';
import { PaymentsService } from '../payments/payments.service';

// A visitor gets their own merchant rather than a shared login
//
// Shared would mean everyone reads everyone else's rows, so one person typing
// something unpleasant into a reference is on the screen of every visitor after
// them. It also means tenant isolation is never actually exercised, and that is
// the part of this codebase most worth showing
const LIFETIME_HOURS = 24;

// .invalid is reserved by RFC 2606 and can never resolve, so none of these can
// collide with a real address or accidentally be mailed
const EMAIL_DOMAIN = 'oathgate.invalid';

const SHOP_NAMES = [
  'Kviria Coffee',
  'Fabrika Bakery',
  'Rustaveli Books',
  'Mtatsminda Roasters',
  'Vake Flowers',
  'Dry Bridge Records',
];

const CURRENCY = 'GEL';
const CRYPTO = 'BTC';
const DAY_MS = 24 * 60 * 60 * 1000;

// What a fortnight of a small shop looks like: mostly settled, a couple that
// came in short, a few nobody ever paid, and something still open so the
// visitor has a button to press
const SCRIPT: { daysAgo: number; amount: string; outcome: Outcome }[] = [
  { daysAgo: 13, amount: '1450', outcome: 'paid' },
  { daysAgo: 13, amount: '850', outcome: 'expired' },
  { daysAgo: 12, amount: '2200', outcome: 'paid' },
  { daysAgo: 11, amount: '1050', outcome: 'paid' },
  { daysAgo: 11, amount: '3400', outcome: 'underpaid' },
  { daysAgo: 10, amount: '750', outcome: 'paid' },
  { daysAgo: 9, amount: '1900', outcome: 'paid' },
  { daysAgo: 9, amount: '1250', outcome: 'expired' },
  { daysAgo: 8, amount: '2750', outcome: 'paid' },
  { daysAgo: 7, amount: '990', outcome: 'paid' },
  { daysAgo: 6, amount: '4100', outcome: 'paid' },
  { daysAgo: 5, amount: '1600', outcome: 'underpaid' },
  { daysAgo: 5, amount: '2050', outcome: 'paid' },
  { daysAgo: 4, amount: '880', outcome: 'paid' },
  { daysAgo: 3, amount: '3150', outcome: 'paid' },
  { daysAgo: 3, amount: '1350', outcome: 'expired' },
  { daysAgo: 2, amount: '2400', outcome: 'paid' },
  { daysAgo: 1, amount: '1750', outcome: 'paid' },
  { daysAgo: 0, amount: '1150', outcome: 'open' },
  { daysAgo: 0, amount: '2600', outcome: 'open' },
];

type Outcome = 'paid' | 'underpaid' | 'expired' | 'open';

@Injectable()
export class SandboxService {
  private readonly logger = new Logger(SandboxService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentsService,
    private readonly settlement: SettlementService,
    private readonly cipher: SecretCipher,
  ) {}

  async create(): Promise<{ merchantId: string; expiresAt: Date }> {
    const expiresAt = new Date(Date.now() + LIFETIME_HOURS * 60 * 60 * 1000);
    const name = SHOP_NAMES[Math.floor(Math.random() * SHOP_NAMES.length)];

    // Nobody signs in with this, and the column is not nullable
    // Random rather than a shared constant, because one known hash across every
    // sandbox is a password that works on all of them
    const passwordHash = await argon2.hash(randomBytes(32).toString('hex'), {
      type: argon2.argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });

    const merchant = await this.prisma.merchant.create({
      data: {
        email: `sandbox+${randomUUID()}@${EMAIL_DOMAIN}`,
        name,
        passwordHash,
        settlementCurrency: CRYPTO,
        isDemo: true,
        expiresAt,
      },
    });

    // Settling looks this up rather than creating it, so it has to exist first
    await this.prisma.account.create({
      data: {
        merchantId: merchant.id,
        kind: AccountKind.MERCHANT_BALANCE,
        currency: CRYPTO,
        mode: KeyMode.TEST,
      },
    });

    await this.endpoint(merchant.id);
    await this.seed(merchant.id);

    this.logger.log(
      `sandbox ${merchant.id} for ${name}, until ${expiresAt.toISOString()}`,
    );

    return { merchantId: merchant.id, expiresAt };
  }

  // Written straight to the table rather than through WebhooksService, because
  // that method refuses a sandbox. The seeder is the system deciding, not a
  // visitor asking
  //
  // example.com is reserved by RFC 2606 for exactly this. Nothing answers on
  // it, so deliveries attempt, back off and eventually dead letter, which is
  // the behaviour the webhooks screen exists to show
  private async endpoint(merchantId: string): Promise<void> {
    const secret = `whsec_${randomBytes(24).toString('base64url')}`;

    await this.prisma.webhookEndpoint.create({
      data: {
        merchantId,
        mode: KeyMode.TEST,
        url: 'https://shop.example/oathgate-hooks',
        secretCiphertext: this.cipher.encrypt(secret),
        secretPrefix: secret.slice(0, 16),
        events: [],
      },
    });
  }

  // Every row goes through the same services a real payment does, so a seeded
  // sandbox cannot show a shape the product would never produce
  //
  // The payment rows are then dated backwards, which the chart needs and which
  // a payment row allows. The ledger entries keep today's date, because today
  // is honestly when they were written and an entry is not mine to rewrite
  private async seed(merchantId: string): Promise<void> {
    for (const [index, step] of SCRIPT.entries()) {
      const payment = await this.payments.create(
        { merchantId, mode: KeyMode.TEST, apiKeyId: null },
        {
          fiatAmount: step.amount,
          fiatCurrency: CURRENCY,
          cryptoCurrency: CRYPTO,
          reference: `order-${4100 + index}`,
        },
      );

      const createdAt = new Date(Date.now() - step.daysAgo * DAY_MS);
      const owed = BigInt(payment.cryptoAmount.toFixed(0));

      if (step.outcome === 'paid') {
        await this.settlement.settle(merchantId, payment.id);
        await this.sighting(payment.id, createdAt, owed);
      }

      // Short by a plausible network fee, which is what an underpayment nearly
      // always is: a wallet taking the fee out of the amount instead of adding
      // it on top. The row is what lets the detail screen say so
      if (step.outcome === 'underpaid') {
        await this.sighting(payment.id, createdAt, owed - 220n);
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: { status: PaymentStatus.UNDERPAID },
        });
      }

      if (step.outcome === 'expired') {
        await this.prisma.payment.update({
          where: { id: payment.id },
          data: { status: PaymentStatus.EXPIRED },
        });
      }

      await this.backdate(payment.id, createdAt, step.outcome);
    }
  }

  // What the worker would have written when it found the money
  //
  // Settling from the dashboard skips this, because no coins move, so without
  // it every payment in a sandbox reads as paid with nothing on chain to
  // explain it
  private async sighting(
    paymentId: string,
    seenAt: Date,
    amount: bigint,
  ): Promise<void> {
    await this.prisma.chainTx.create({
      data: {
        paymentId,
        txid: randomBytes(32).toString('hex'),
        blockHash: randomBytes(32).toString('hex'),
        amount: amount.toString(),
        currency: CRYPTO,
        confirmations: 1 + Math.floor(Math.random() * 40),
        seenAt,
      },
    });
  }

  // Raw, because updatedAt carries @updatedAt and Prisma overwrites it on any
  // write it builds itself. The whole point here is to set it
  private async backdate(
    paymentId: string,
    createdAt: Date,
    outcome: Outcome,
  ): Promise<void> {
    // Somewhere between one and forty minutes after it was asked for, which is
    // what makes the median settlement time on the insights screen a real
    // number rather than a rounding of zero
    const settledAt = new Date(
      createdAt.getTime() + (1 + Math.random() * 39) * 60_000,
    );
    const updatedAt = outcome === 'open' ? createdAt : settledAt;
    const expiresAt = new Date(createdAt.getTime() + 15 * 60_000);

    await this.prisma.$executeRaw`
      UPDATE payment
      SET "createdAt" = ${createdAt},
          "updatedAt" = ${updatedAt},
          "expiresAt" = ${expiresAt}
      WHERE id = ${paymentId}::uuid
    `;
  }
}
