import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from '@jest/globals';
import { createServer, type Server } from 'node:http';
import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import {
  BACKOFF_SECONDS,
  KeyMode,
  PrismaModule,
  PrismaService,
  SecretCipher,
  WebhookDeliveryStatus,
} from '@app/shared';
import { OutboundHostService } from '../apps/worker/src/webhooks/outbound-host.service';
import { WebhookSenderService } from '../apps/worker/src/webhooks/webhook-sender.service';

// Three tries is enough to see one retry scheduled and then the budget run out
const MAX_ATTEMPTS = 3;

describe('webhook delivery when the merchant is down', () => {
  let moduleRef: TestingModule;
  let prisma: PrismaService;
  let sender: WebhookSenderService;

  let server: Server;
  let url: string;
  let hits = 0;

  let merchantId: string;
  let deliveryId: string;

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule],
      providers: [WebhookSenderService, SecretCipher, OutboundHostService],
    })
      // The endpoint under test is on 127.0.0.1, which the real check refuses
      // These tests are about the retry schedule, not about where a webhook is
      // allowed to point, and that policy has its own tests
      .overrideProvider(OutboundHostService)
      .useValue({ assertAllowed: () => Promise.resolve() })
      .compile();

    await moduleRef.init();

    prisma = moduleRef.get(PrismaService);
    sender = moduleRef.get(WebhookSenderService);

    // A merchant whose server is up but broken, which is the common case
    // A refused connection would only prove the timeout path
    server = createServer((_request, response) => {
      hits += 1;
      response.writeHead(500).end('nope');
    });

    await new Promise<void>((ready) => server.listen(0, '127.0.0.1', ready));

    const address = server.address();

    if (address === null || typeof address === 'string') {
      throw new Error('the test server did not take a port');
    }

    url = `http://127.0.0.1:${address.port}/hook`;
  });

  afterAll(async () => {
    await new Promise<void>((closed) => server.close(() => closed()));
    await moduleRef.close();
  });

  beforeEach(async () => {
    hits = 0;

    const stamp = Date.now();

    const merchant = await prisma.merchant.create({
      data: {
        email: `retry-${stamp}@oathgate.test`,
        name: 'Retry Test',
        settlementCurrency: 'GEL',
        passwordHash: 'not-a-real-hash',
      },
    });

    merchantId = merchant.id;

    // Written straight to the table, because the url check in the api refuses
    // a loopback address on purpose
    const endpoint = await prisma.webhookEndpoint.create({
      data: {
        merchantId,
        mode: KeyMode.TEST,
        url,
        secretCiphertext: moduleRef.get(SecretCipher).encrypt('whsec_test'),
        secretPrefix: 'whsec_test',
        events: ['payment.completed'],
      },
    });

    const event = await prisma.outboxEvent.create({
      data: {
        aggregateType: 'payment',
        aggregateId: merchantId,
        merchantId,
        mode: KeyMode.TEST,
        eventType: 'payment.completed',
        payload: { paymentId: 'test' },
      },
    });

    const delivery = await prisma.webhookDelivery.create({
      data: {
        merchantId,
        endpointId: endpoint.id,
        outboxEventId: event.id,
        mode: KeyMode.TEST,
        eventType: 'payment.completed',
        payload: { paymentId: 'test' },
        maxAttempts: MAX_ATTEMPTS,
        nextAttemptAt: new Date(),
      },
    });

    deliveryId = delivery.id;
  });

  afterEach(async () => {
    await prisma.webhookAttempt.deleteMany({ where: { deliveryId } });
    await prisma.webhookDelivery.deleteMany({ where: { merchantId } });
    await prisma.outboxEvent.deleteMany({ where: { merchantId } });
    await prisma.webhookEndpoint.deleteMany({ where: { merchantId } });
    await prisma.merchant.deleteMany({ where: { id: merchantId } });
  });

  it('schedules a retry after the first failure', async () => {
    await sender.deliver(deliveryId);

    const delivery = await prisma.webhookDelivery.findUniqueOrThrow({
      where: { id: deliveryId },
    });

    expect(hits).toBe(1);
    expect(delivery.attempts).toBe(1);
    expect(delivery.status).toBe(WebhookDeliveryStatus.PENDING);
    expect(delivery.lastResponseStatus).toBe(500);

    // Due again on the first step of the backoff list, not immediately
    expect(delivery.nextAttemptAt).not.toBeNull();

    const wait =
      (delivery.nextAttemptAt as Date).getTime() - delivery.updatedAt.getTime();

    expect(wait).toBeGreaterThanOrEqual(BACKOFF_SECONDS[0] * 1000 - 1000);
  });

  it('gives up into the dead letter state once the budget is spent', async () => {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      // The sweep would wait for nextAttemptAt, so bring it forward
      await prisma.webhookDelivery.updateMany({
        where: { id: deliveryId, status: WebhookDeliveryStatus.PENDING },
        data: { nextAttemptAt: new Date() },
      });

      await sender.deliver(deliveryId);
    }

    const delivery = await prisma.webhookDelivery.findUniqueOrThrow({
      where: { id: deliveryId },
    });

    expect(hits).toBe(MAX_ATTEMPTS);
    expect(delivery.attempts).toBe(MAX_ATTEMPTS);
    expect(delivery.status).toBe(WebhookDeliveryStatus.DEAD_LETTER);

    // Null so the retry sweep stops picking it up
    expect(delivery.nextAttemptAt).toBeNull();

    // One row per try, so the log shows what happened rather than just a count
    const attempts = await prisma.webhookAttempt.findMany({
      where: { deliveryId },
      orderBy: { attempt: 'asc' },
      select: { attempt: true, responseStatus: true },
    });

    expect(attempts.map((a) => a.attempt)).toEqual([1, 2, 3]);
    expect(attempts.every((a) => a.responseStatus === 500)).toBe(true);
  });

  it('does nothing when the delivery is already finished', async () => {
    await prisma.webhookDelivery.update({
      where: { id: deliveryId },
      data: { status: WebhookDeliveryStatus.DELIVERED },
    });

    await sender.deliver(deliveryId);

    // The queue can hand the same job over twice, and a merchant should not
    // see the same event again because of it
    expect(hits).toBe(0);
  });
});
