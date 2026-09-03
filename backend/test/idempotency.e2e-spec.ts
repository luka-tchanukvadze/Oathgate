import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from '@jest/globals';
import { createHash } from 'node:crypto';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaModule, PrismaService } from '@app/shared';
import { IdempotencyService } from '../apps/api/src/idempotency/idempotency.service';

// requestHash is char(64) in Postgres, which blank pads anything shorter
// Production hashes with SHA-256 so it always fits exactly, and a test that
// used a short string would compare a padded value against an unpadded one
const hash = (body: string) => createHash('sha256').update(body).digest('hex');

describe('idempotency', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let idempotency: IdempotencyService;

  let merchantId: string;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule],
      providers: [IdempotencyService],
    }).compile();

    await moduleRef.init();

    prisma = moduleRef.get(PrismaService);
    idempotency = moduleRef.get(IdempotencyService);
  });

  afterAll(async () => {
    await moduleRef.close();
  });

  beforeEach(async () => {
    const merchant = await prisma.merchant.create({
      data: {
        email: `idem-${Date.now()}@oathgate.test`,
        name: 'Idempotency Test',
        settlementCurrency: 'GEL',
        passwordHash: 'not-a-real-hash',
      },
    });

    merchantId = merchant.id;
  });

  afterEach(async () => {
    await prisma.idempotencyKey.deleteMany({ where: { merchantId } });
    await prisma.merchant.deleteMany({ where: { id: merchantId } });
  });

  it('runs the work once and replays the answer', async () => {
    let ran = 0;

    const call = () =>
      idempotency.run({
        merchantId,
        key: 'same-key',
        requestHash: hash('body'),
        successStatus: 201,
        handler: () => {
          ran += 1;

          return Promise.resolve({ id: 'payment-1', amount: '1050' });
        },
      });

    const first = await call();
    const second = await call();

    // The second caller never reached the handler
    expect(ran).toBe(1);
    expect(second).toEqual(first);
  });

  it('refuses the same key used for a different request', async () => {
    await idempotency.run({
      merchantId,
      key: 'reused-key',
      requestHash: hash('first body'),
      successStatus: 201,
      handler: () => Promise.resolve({ id: 'payment-1' }),
    });

    // Answering this quietly would tell the caller yes to a question they
    // did not ask
    await expect(
      idempotency.run({
        merchantId,
        key: 'reused-key',
        requestHash: hash('a different body'),
        successStatus: 201,
        handler: () => Promise.resolve({ id: 'payment-2' }),
      }),
    ).rejects.toMatchObject({ status: 422 });
  });

  it('releases the key when the work fails, so a retry can run', async () => {
    const failing = idempotency.run({
      merchantId,
      key: 'failing-key',
      requestHash: hash('body'),
      successStatus: 201,
      handler: () => Promise.reject(new Error('rate provider is down')),
    });

    await expect(failing).rejects.toThrow('rate provider is down');

    // Nothing was created, so nothing should be replayed
    // Holding the claim would block this merchant from that key for 24 hours
    // over a failure that had nothing to do with them
    const left = await prisma.idempotencyKey.count({
      where: { merchantId, key: 'failing-key' },
    });

    expect(left).toBe(0);

    let ran = 0;

    const retried = await idempotency.run({
      merchantId,
      key: 'failing-key',
      requestHash: hash('body'),
      successStatus: 201,
      handler: () => {
        ran += 1;

        return Promise.resolve({ id: 'payment-1' });
      },
    });

    expect(ran).toBe(1);
    expect(retried).toEqual({ id: 'payment-1' });
  });

  it('tells a second caller to wait while the first is still running', async () => {
    let release: () => void = () => {};
    const held = new Promise<void>((done) => {
      release = done;
    });

    const first = idempotency.run({
      merchantId,
      key: 'in-flight-key',
      requestHash: hash('body'),
      successStatus: 201,
      handler: async () => {
        await held;

        return { id: 'payment-1' };
      },
    });

    // Long enough for the claim row to be committed
    await new Promise((done) => setTimeout(done, 50));

    await expect(
      idempotency.run({
        merchantId,
        key: 'in-flight-key',
        requestHash: hash('body'),
        successStatus: 201,
        handler: () => Promise.resolve({ id: 'payment-2' }),
      }),
    ).rejects.toMatchObject({ status: 409 });

    release();
    await first;
  });
});
