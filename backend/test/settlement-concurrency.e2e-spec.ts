import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import {
  AccountKind,
  AccountsService,
  KeyMode,
  LedgerService,
  PaymentStatus,
  PrismaService,
  SettlementModule,
  SettlementService,
} from '@app/shared';

// Fifty workers reaching for the same payment at the same instant
// One at a time proves nothing, and the bug this guards against only appears
// when they overlap
const WORKERS = 50;

// Every query inside a settlement is slowed by this much
// Without it the fifty transactions are staggered further apart by javascript
// dispatch than a settlement takes to finish, so they never actually overlap
// and the test passes whether the row lock is there or not
const QUERY_DELAY_MS = 25;

const sleep = (ms: number) => new Promise((done) => setTimeout(done, ms));

const OWED = 4996n;

describe('settlement under concurrency', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let settlement: SettlementService;

  let merchantId: string;
  let paymentId: string;
  let balanceId: string;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), SettlementModule],
    }).compile();

    await moduleRef.init();

    prisma = moduleRef.get(PrismaService);

    // The real client, with every query held open long enough that fifty
    // settlements are genuinely inside the critical section together
    const slow = prisma.$extends({
      query: {
        async $allOperations({ args, query }) {
          await sleep(QUERY_DELAY_MS);

          return (await query(args)) as unknown;
        },
      },
    });

    settlement = new SettlementService(
      slow as unknown as PrismaService,
      moduleRef.get(LedgerService),
      moduleRef.get(AccountsService),
    );
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  beforeEach(async () => {
    const stamp = Date.now();

    const merchant = await prisma.merchant.create({
      data: {
        email: `concurrency-${stamp}@oathgate.test`,
        name: 'Concurrency Test',
        settlementCurrency: 'GEL',
        passwordHash: 'not-a-real-hash',
      },
    });

    merchantId = merchant.id;

    // The house side of the movement, shared with anything else already seeded
    const wallet = await prisma.account.findFirst({
      where: {
        merchantId: null,
        kind: AccountKind.GATEWAY_WALLET,
        currency: 'BTC',
        mode: KeyMode.TEST,
      },
      select: { id: true },
    });

    if (!wallet) {
      await prisma.account.create({
        data: {
          kind: AccountKind.GATEWAY_WALLET,
          currency: 'BTC',
          mode: KeyMode.TEST,
        },
      });
    }

    const balance = await prisma.account.create({
      data: {
        merchantId,
        kind: AccountKind.MERCHANT_BALANCE,
        currency: 'BTC',
        mode: KeyMode.TEST,
      },
    });

    balanceId = balance.id;

    const payment = await prisma.payment.create({
      data: {
        merchantId,
        mode: KeyMode.TEST,
        fiatAmount: '1000',
        fiatCurrency: 'GEL',
        cryptoAmount: OWED.toString(),
        cryptoCurrency: 'BTC',
        quotedRate: '202665',
        address: `tb1qtest${stamp}`,
        derivationIndex: 0,
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    paymentId = payment.id;
  });

  afterEach(async () => {
    await prisma.ledgerEntry.deleteMany({ where: { paymentId } });
    await prisma.outboxEvent.deleteMany({ where: { merchantId } });
    await prisma.payment.deleteMany({ where: { merchantId } });
    await prisma.account.deleteMany({ where: { merchantId } });
    await prisma.merchant.deleteMany({ where: { id: merchantId } });
  });

  it('credits the merchant once when fifty workers settle at the same time', async () => {
    const results = await Promise.allSettled(
      Array.from({ length: WORKERS }, () =>
        settlement.settle(merchantId, paymentId, OWED),
      ),
    );

    const fulfilled = results.filter((r) => r.status === 'fulfilled');

    // Nothing throws, and that is worth asserting on its own
    // A caller that has to catch an error to stay correct is one bad catch
    // away from being wrong
    expect(fulfilled).toHaveLength(WORKERS);

    const winners = fulfilled.filter(
      (r) => r.status === 'fulfilled' && !r.value.alreadySettled,
    );

    // One did the work, forty nine found it already done
    expect(winners).toHaveLength(1);

    const entries = await prisma.ledgerEntry.findMany({
      where: { paymentId },
      select: { direction: true, amount: true, transferId: true },
    });

    // Two rows, one transfer, not a hundred rows and fifty transfers
    expect(entries).toHaveLength(2);
    expect(new Set(entries.map((e) => e.transferId)).size).toBe(1);

    // The pair sums to nothing, which is the invariant the ledger exists for
    const net = entries.reduce(
      (total, entry) =>
        entry.direction === 'CREDIT'
          ? total + BigInt(entry.amount.toFixed(0))
          : total - BigInt(entry.amount.toFixed(0)),
      0n,
    );

    expect(net).toBe(0n);

    const balance = await prisma.account.findUniqueOrThrow({
      where: { id: balanceId },
      select: { balance: true },
    });

    // 4996, not 249800
    expect(BigInt(balance.balance.toFixed(0))).toBe(OWED);

    const payment = await prisma.payment.findUniqueOrThrow({
      where: { id: paymentId },
      select: { status: true },
    });

    expect(payment.status).toBe(PaymentStatus.PAID);

    // Told once, not fifty times
    const events = await prisma.outboxEvent.count({
      where: { aggregateId: paymentId, eventType: 'payment.completed' },
    });

    expect(events).toBe(1);
  }, 60_000);
});
