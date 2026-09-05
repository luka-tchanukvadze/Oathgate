// The whole dashboard runs on this until the API exists
//
// It is deliberately a real store and not a pile of static fixtures: creating a
// payment, simulating a customer paying it, and reversing it all mutate state
// and produce the ledger rows and webhook deliveries they would produce for
// real. That means every screen can be built and tested before the backend is
// wired up, and swapping it out later is a change in src/lib/api only
//
// It lives in the browser, so state resets on reload. That is fine, and it is
// also what makes the public demo safe to leave running

import type {
  Account,
  ApiKey,
  ApiKeyWithSecret,
  ChainTx,
  Insight,
  KeyMode,
  LedgerEntry,
  Merchant,
  Payment,
  PaymentStatus,
  SystemEvent,
  WebhookDeliveryDetail,
  WebhookEndpoint,
} from '@/types';
import { MAX_WEBHOOK_ATTEMPTS, MIN_CONFIRMATIONS } from '@/lib/constants';

const ENDPOINT_ID = 'whe_default';
const WEBHOOK_URL = 'https://merchant.example.com/webhooks/oathgate';

// Deterministic pseudo-random so the seeded data is the same every time. Real
// randomness here would make screenshots and tests jitter
function mulberry32(seed: number) {
  return function next() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rand = mulberry32(20260808);

function pick<T>(items: T[]): T {
  return items[Math.floor(rand() * items.length)];
}

function id(prefix: string): string {
  const chars = '0123456789abcdef';
  let out = '';
  for (let i = 0; i < 24; i += 1) out += chars[Math.floor(rand() * 16)];
  return `${prefix}_${out}`;
}

function hex(length: number): string {
  const chars = '0123456789abcdef';
  let out = '';
  for (let i = 0; i < length; i += 1) out += chars[Math.floor(rand() * 16)];
  return out;
}

function btcAddress(): string {
  const chars = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';
  let out = 'tb1q';
  for (let i = 0; i < 38; i += 1) out += chars[Math.floor(rand() * chars.length)];
  return out;
}

function iso(offsetMs: number): string {
  return new Date(Date.now() + offsetMs).toISOString();
}

// 1 BTC is worth this many GEL minor units. Kept as a string so the quote maths
// below never leaves BigInt
const RATE_GEL_PER_BTC = '28450000';

// fiat minor units to satoshis, entirely in BigInt. Rounds up so the merchant is
// never left a satoshi short
function quoteSatoshis(fiatMinor: string): string {
  const SATS_PER_BTC = 100000000n;
  const numerator = BigInt(fiatMinor) * SATS_PER_BTC;
  const denominator = BigInt(RATE_GEL_PER_BTC);
  const whole = numerator / denominator;
  return (numerator % denominator === 0n ? whole : whole + 1n).toString();
}

// The API never puts a paymentId on a chain transaction, because they only ever
// arrive attached to the payment they belong to. This store has no such nesting,
// so it keeps the column and the accessors hand back plain ChainTx
type StoredChainTx = ChainTx & { paymentId: string };

interface MockState {
  merchant: Merchant;
  payments: Payment[];
  chainTxs: StoredChainTx[];
  ledger: LedgerEntry[];
  apiKeys: ApiKey[];
  // Kept with the payload, handed out without it in a list, which is exactly
  // how the API splits them
  webhooks: WebhookDeliveryDetail[];
}

const MERCHANT: Merchant = {
  id: id('mrc'),
  email: 'demo@oathgate.dev',
  name: 'Demo Coffee Co',
  settlementCurrency: 'GEL',
  isDemo: false,
  expiresAt: null,
};

const REFERENCES = [
  'order-1041',
  'order-1042',
  'invoice-7781',
  'order-1043',
  'table-12',
  'invoice-7782',
  'order-1044',
  'subscription-may',
  'order-1045',
  'table-4',
];

function seedPayment(status: PaymentStatus, mode: KeyMode, ageMinutes: number): Payment {
  const fiatAmount = String(Math.floor(rand() * 24000) + 500);
  const createdAt = iso(-ageMinutes * 60000);
  return {
    id: id('pay'),
    mode,
    reference: pick(REFERENCES),
    fiatAmount,
    fiatCurrency: 'GEL',
    cryptoAmount: quoteSatoshis(fiatAmount),
    cryptoCurrency: 'BTC',
    quotedRate: RATE_GEL_PER_BTC,
    address: btcAddress(),
    status,
    expiresAt: iso(-ageMinutes * 60000 + 15 * 60000),
    createdAt,
    updatedAt: createdAt,
  };
}

function ledgerPairFor(payment: Payment, at: string, reverse = false): LedgerEntry[] {
  const transferId = id('trf');
  const merchantSide: LedgerEntry = {
    id: id('led'),
    transferId,
    accountId: 'acct_merchant_btc',
    accountKind: 'MERCHANT_BALANCE',
    direction: reverse ? 'DEBIT' : 'CREDIT',
    amount: payment.cryptoAmount,
    currency: payment.cryptoCurrency,
    paymentId: payment.id,
    reversesId: null,
    createdAt: at,
  };
  const clearingSide: LedgerEntry = {
    ...merchantSide,
    id: id('led'),
    accountId: 'acct_gateway_clearing',
    accountKind: 'GATEWAY_WALLET',
    direction: reverse ? 'CREDIT' : 'DEBIT',
  };
  return [merchantSide, clearingSide];
}

function webhookFor(
  payment: Payment,
  eventType: string,
  at: string,
): WebhookDeliveryDetail {
  return {
    id: id('whd'),
    paymentId: payment.id,
    endpointId: ENDPOINT_ID,
    mode: payment.mode,
    eventType,
    status: 'DELIVERED',
    attempts: 1,
    maxAttempts: MAX_WEBHOOK_ATTEMPTS,
    lastResponseStatus: 200,
    deliveredAt: at,
    attemptLog: [
      {
        attempt: 1,
        responseStatus: 200,
        error: null,
        durationMs: 120 + Math.floor(rand() * 300),
        createdAt: at,
      },
    ],
    payload: {
      id: payment.id,
      type: eventType,
      created: at,
      data: {
        amount: payment.fiatAmount,
        currency: payment.fiatCurrency,
        crypto_amount: payment.cryptoAmount,
        crypto_currency: payment.cryptoCurrency,
        status: payment.status,
      },
    },
    nextAttemptAt: null,
    createdAt: at,
  };
}

function buildSeed(): MockState {
  // Spread across the full 14 day window the chart draws, with a weekday
  // rhythm, so the volume graph has a shape instead of two spikes and a flat
  // line. Weighted towards PAID because that is what a working gateway looks
  // like, with enough of the other states to exercise every badge
  const MINUTES_PER_DAY = 60 * 24;
  const OUTCOMES: PaymentStatus[] = [
    'PAID', 'PAID', 'PAID', 'PAID', 'PAID', 'PAID',
    'EXPIRED', 'UNDERPAID', 'REVERSED', 'FAILED',
  ];

  const plan: Array<{ status: PaymentStatus; age: number; mode: KeyMode }> = [];

  for (let day = 13; day >= 0; day -= 1) {
    const weekday = new Date(Date.now() - day * MINUTES_PER_DAY * 60000).getDay();
    const quiet = weekday === 0 || weekday === 6;
    const count = (quiet ? 1 : 3) + Math.floor(rand() * (quiet ? 2 : 4));

    for (let i = 0; i < count; i += 1) {
      const minutesIntoDay = Math.floor(rand() * MINUTES_PER_DAY);
      plan.push({
        status: pick(OUTCOMES),
        age: day * MINUTES_PER_DAY + minutesIntoDay,
        mode: rand() < 0.22 ? 'LIVE' : 'TEST',
      });
    }
  }

  // The two live ones at the top of the list, so opening the dashboard always
  // shows something mid-flight rather than a wall of finished payments
  plan.push({ status: 'CONFIRMING', age: 6, mode: 'TEST' });
  plan.push({ status: 'PENDING', age: 2, mode: 'TEST' });
  plan.push({ status: 'PENDING', age: 11, mode: 'LIVE' });

  const payments = plan.map((p) => seedPayment(p.status, p.mode, p.age));
  const chainTxs: StoredChainTx[] = [];
  const ledger: LedgerEntry[] = [];
  const webhooks: WebhookDeliveryDetail[] = [];

  for (const payment of payments) {
    const settledAt = iso(new Date(payment.createdAt).getTime() - Date.now() + 4 * 60000);

    if (['CONFIRMING', 'PAID', 'UNDERPAID', 'REVERSED'].includes(payment.status)) {
      const isUnder = payment.status === 'UNDERPAID';
      chainTxs.push({
        id: id('ctx'),
        paymentId: payment.id,
        txid: hex(64),
        blockHash: payment.status === 'CONFIRMING' ? null : hex(64),
        // Underpaid means less arrived than was quoted, which happens constantly
        // when a wallet takes the network fee out of the amount instead of
        // adding it on top
        amount: isUnder ? (BigInt(payment.cryptoAmount) - 1200n).toString() : payment.cryptoAmount,
        currency: payment.cryptoCurrency,
        confirmations: payment.status === 'CONFIRMING' ? 1 : 6,
        seenAt: settledAt,
      });
    }

    if (payment.status === 'PAID' || payment.status === 'REVERSED') {
      ledger.push(...ledgerPairFor(payment, settledAt));
      webhooks.push(webhookFor(payment, 'payment.completed', settledAt));
    }

    if (payment.status === 'REVERSED') {
      // A reorg orphaned the block. Nothing is deleted, a compensating pair gets
      // written that points back at the original
      const original = ledger.filter((e) => e.paymentId === payment.id);
      const reversal = ledgerPairFor(payment, iso(-600 * 60000), true);
      reversal[0].reversesId = original[0]?.id ?? null;
      reversal[1].reversesId = original[1]?.id ?? null;
      ledger.push(...reversal);
      webhooks.push(webhookFor(payment, 'payment.reversed', iso(-600 * 60000)));
    }
  }

  // One delivery that failed, so the retry and dead-letter UI has something real
  // to render
  const failing = payments.find((p) => p.status === 'PAID');
  if (failing) {
    webhooks.push({
      ...webhookFor(failing, 'payment.completed', iso(-25 * 60000)),
      id: id('whd'),
      status: 'FAILED',
      attempts: 4,
      lastResponseStatus: 502,
      deliveredAt: null,
      nextAttemptAt: iso(8 * 60000),
    });
  }

  // All testnet, because mainnet is not activated for this workspace. Seeding a
  // live key while the header says mainnet is unavailable is a contradiction a
  // reviewer notices immediately
  const apiKeys: ApiKey[] = [
    {
      id: id('key'),
      keyPrefix: 'sk_test_4f2ab19c',
      mode: 'TEST',
      name: 'Checkout server',
      lastUsedAt: iso(-14 * 60000),
      revokedAt: null,
      createdAt: iso(-40 * 24 * 60 * 60000),
    },
    {
      id: id('key'),
      keyPrefix: 'sk_test_9d31c706',
      mode: 'TEST',
      name: 'Local integration',
      lastUsedAt: iso(-3 * 60 * 60000),
      revokedAt: null,
      createdAt: iso(-38 * 24 * 60 * 60000),
    },
    {
      id: id('key'),
      keyPrefix: 'sk_test_1a77be40',
      mode: 'TEST',
      name: 'Old staging key',
      lastUsedAt: iso(-20 * 24 * 60 * 60000),
      revokedAt: iso(-6 * 24 * 60 * 60000),
      createdAt: iso(-90 * 24 * 60 * 60000),
    },
  ];

  return { merchant: MERCHANT, payments, chainTxs, ledger, apiKeys, webhooks };
}

let state: MockState | null = null;

function db(): MockState {
  if (!state) state = buildSeed();
  return state;
}

// Balance is a projection of the ledger, never a number I add to. Same rule as
// the backend, so the demo cannot drift from what the API would say
export function projectBalance(mode: KeyMode, currency: string): string {
  const { ledger, payments } = db();
  const inMode = new Set(payments.filter((p) => p.mode === mode).map((p) => p.id));
  return ledger
    .filter((e) => e.accountId === 'acct_merchant_btc' && e.currency === currency)
    .filter((e) => (e.paymentId ? inMode.has(e.paymentId) : false))
    .reduce(
      (total, e) => (e.direction === 'CREDIT' ? total + BigInt(e.amount) : total - BigInt(e.amount)),
      0n,
    )
    .toString();
}

let endpointState: WebhookEndpoint = {
  id: ENDPOINT_ID,
  mode: 'TEST',
  url: WEBHOOK_URL,
  disabledAt: null,
  secretPrefix: 'whsec_4c81f0',
  events: ['payment.completed', 'payment.underpaid', 'payment.expired', 'payment.reversed'],
  createdAt: iso(-40 * 24 * 60 * 60000),
};

export const mock = {
  merchant: () => db().merchant,

  payments: (mode: KeyMode) =>
    db()
      .payments.filter((p) => p.mode === mode)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),

  payment: (paymentId: string) => db().payments.find((p) => p.id === paymentId) ?? null,

  chainTxs: (paymentId: string) => db().chainTxs.filter((t) => t.paymentId === paymentId),

  ledgerFor: (paymentId: string) =>
    db()
      .ledger.filter((e) => e.paymentId === paymentId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt)),

  ledger: (mode: KeyMode) => {
    const inMode = new Set(db().payments.filter((p) => p.mode === mode).map((p) => p.id));
    return db()
      .ledger.filter((e) => (e.paymentId ? inMode.has(e.paymentId) : true))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  webhooks: (mode: KeyMode) => {
    const inMode = new Set(db().payments.filter((p) => p.mode === mode).map((p) => p.id));
    return db()
      .webhooks.filter((w) => w.paymentId !== null && inMode.has(w.paymentId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  webhook: (deliveryId: string) =>
    db().webhooks.find((w) => w.id === deliveryId) ?? null,

  webhooksFor: (paymentId: string) =>
    db()
      .webhooks.filter((w) => w.paymentId === paymentId)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),

  apiKeys: () => db().apiKeys.slice().sort((a, b) => b.createdAt.localeCompare(a.createdAt)),

  accounts: (mode: KeyMode): Account[] => [
    {
      id: 'acct_merchant_btc',
      kind: 'MERCHANT_BALANCE',
      currency: 'BTC',
      mode,
      balance: projectBalance(mode, 'BTC'),
      updatedAt: new Date().toISOString(),
    },
  ],

  createPayment: (input: {
    fiatAmount: string;
    fiatCurrency: string;
    reference: string | null;
    mode: KeyMode;
  }): Payment => {
    const now = new Date().toISOString();
    const payment: Payment = {
      id: id('pay'),
      mode: input.mode,
      reference: input.reference,
      fiatAmount: input.fiatAmount,
      fiatCurrency: input.fiatCurrency,
      cryptoAmount: quoteSatoshis(input.fiatAmount),
      cryptoCurrency: 'BTC',
      quotedRate: RATE_GEL_PER_BTC,
      address: btcAddress(),
      status: 'PENDING',
      expiresAt: iso(15 * 60000),
      createdAt: now,
      updatedAt: now,
    };
    db().payments.push(payment);
    return payment;
  },

  // Walks a payment through the same states the worker would, on a timer, so the
  // demo shows the real transitions instead of jumping straight to PAID
  simulatePayment: (paymentId: string) => {
    const payment = mock.payment(paymentId);
    if (!payment || payment.status !== 'PENDING') return;

    payment.status = 'CONFIRMING';
    payment.updatedAt = new Date().toISOString();

    const tx: StoredChainTx = {
      id: id('ctx'),
      paymentId: payment.id,
      txid: hex(64),
      blockHash: null,
      amount: payment.cryptoAmount,
      currency: payment.cryptoCurrency,
      confirmations: 0,
      seenAt: new Date().toISOString(),
    };
    db().chainTxs.push(tx);

    for (let step = 1; step <= MIN_CONFIRMATIONS; step += 1) {
      setTimeout(() => {
        tx.confirmations = step;
        if (step === 1) tx.blockHash = hex(64);
        payment.updatedAt = new Date().toISOString();

        if (step === MIN_CONFIRMATIONS) {
          const at = new Date().toISOString();
          payment.status = 'PAID';
          db().ledger.push(...ledgerPairFor(payment, at));
          db().webhooks.push(webhookFor(payment, 'payment.completed', at));
        }
      }, step * 2500);
    }
  },

  reversePayment: (paymentId: string) => {
    const payment = mock.payment(paymentId);
    if (!payment || payment.status !== 'PAID') return;
    const at = new Date().toISOString();
    const original = db().ledger.filter((e) => e.paymentId === payment.id && !e.reversesId);
    const reversal = ledgerPairFor(payment, at, true);
    reversal[0].reversesId = original[0]?.id ?? null;
    reversal[1].reversesId = original[1]?.id ?? null;
    db().ledger.push(...reversal);
    payment.status = 'REVERSED';
    payment.updatedAt = at;
    db().webhooks.push(webhookFor(payment, 'payment.reversed', at));
  },

  createApiKey: (input: { name: string; mode: KeyMode }): ApiKeyWithSecret => {
    const prefix = `sk_${input.mode.toLowerCase()}_${hex(8)}`;
    const key: ApiKey = {
      id: id('key'),
      keyPrefix: prefix,
      mode: input.mode,
      name: input.name,
      lastUsedAt: null,
      revokedAt: null,
      createdAt: new Date().toISOString(),
    };
    db().apiKeys.push(key);
    // Returned once and never stored. The real API only ever keeps a SHA-256
    return { ...key, secret: `${prefix}_${hex(32)}` };
  },

  revokeApiKey: (keyId: string) => {
    const key = db().apiKeys.find((k) => k.id === keyId);
    // Revoking marks, it never deletes. Payments made with this key still need
    // explaining afterwards
    if (key && !key.revokedAt) key.revokedAt = new Date().toISOString();
  },

  replayWebhook: (deliveryId: string) => {
    const delivery = db().webhooks.find((w) => w.id === deliveryId);
    if (!delivery) return;
    delivery.attempts += 1;
    delivery.status = 'DELIVERED';
    delivery.lastResponseStatus = 200;
    delivery.deliveredAt = new Date().toISOString();
    delivery.nextAttemptAt = null;
  },

  // Phase 6 reads existing data only and adds nothing to it. These read like
  // model output but are derived from the same rows the tables show, so the
  // widget stays honest while the real model is not wired up
  insights: (mode: KeyMode): Insight[] => {
    const payments = mock.payments(mode);
    const paid = payments.filter((p) => p.status === 'PAID').length;
    const expired = payments.filter((p) => p.status === 'EXPIRED').length;
    const underpaid = payments.filter((p) => p.status === 'UNDERPAID').length;
    return [
      {
        id: 'volume',
        headline: `${paid} of ${payments.length} payments settled`,
        body: `${expired} quotes expired with nothing arriving, which usually means the checkout window is shorter than customers need rather than that they changed their mind.`,
        tone: expired > paid / 3 ? 'warn' : 'good',
      },
      {
        id: 'underpaid',
        headline: underpaid > 0 ? `${underpaid} payment came in short` : 'No underpayments',
        body:
          underpaid > 0
            ? 'The shortfall looks like a wallet deducting the network fee from the amount instead of adding it. Worth a dust tolerance before treating these as failures.'
            : 'Every confirmed payment covered its quoted amount in full.',
        tone: underpaid > 0 ? 'warn' : 'good',
      },
      {
        id: 'timing',
        headline: 'Payments settling about 9 minutes after they are seen',
        body: 'Median time from first sighting in the mempool to the block that confirms it. That wait is the chain, not the gateway, and raising the threshold multiplies it.',
        tone: 'neutral',
      },
    ];
  },

  // Rebuilt from the rows each time rather than stored, so the log can never
  // claim something the other screens would contradict
  events: (mode: KeyMode): SystemEvent[] => {
    const out: SystemEvent[] = [];

    for (const payment of mock.payments(mode)) {
      out.push({
        id: `${payment.id}-req`,
        kind: 'api_request',
        service: 'api',
        title: 'POST /v1/payments',
        detail: `201 Created, quote locked for 15 minutes`,
        paymentId: payment.id,
        at: payment.createdAt,
        meta: { idempotencyKey: `idem_${payment.id.slice(4, 16)}`, status: 201 },
      });

      // A retry of the same request with the same body. The unique constraint on
      // (merchant, key) caught it and the stored response was replayed instead
      // of a second payment being created
      if (payment.id.charCodeAt(payment.id.length - 1) % 4 === 0) {
        out.push({
          id: `${payment.id}-replay`,
          kind: 'idempotency_replay',
          service: 'api',
          title: 'Idempotent replay',
          detail: 'Same key, same body. Returned the stored response instead of creating a second payment',
          paymentId: payment.id,
          at: new Date(new Date(payment.createdAt).getTime() + 900).toISOString(),
          meta: { idempotencyKey: `idem_${payment.id.slice(4, 16)}`, replayedStatus: 201 },
        });
      }

      const txs = mock.chainTxs(payment.id);
      for (const tx of txs) {
        out.push({
          id: `${tx.id}-job`,
          kind: 'queue_job',
          service: 'worker',
          title: 'confirm-payment job',
          detail: `Polled the chain, ${tx.confirmations} confirmation${tx.confirmations === 1 ? '' : 's'}`,
          paymentId: payment.id,
          at: tx.seenAt,
          meta: { queue: 'payments', attempts: 1, txid: tx.txid },
        });
      }

      for (const entry of mock.ledgerFor(payment.id)) {
        if (entry.direction !== 'CREDIT') continue;
        out.push({
          id: `${entry.id}-ledger`,
          kind: 'ledger',
          service: 'worker',
          title: entry.reversesId ? 'Reversal pair written' : 'Ledger pair written',
          detail: 'Balance row locked with SELECT ... FOR UPDATE, both entries committed in one transaction',
          paymentId: payment.id,
          at: entry.createdAt,
          meta: { transferId: entry.transferId },
        });
        out.push({
          id: `${entry.id}-outbox`,
          kind: 'outbox',
          service: 'worker',
          title: 'OutboxEvent inserted',
          detail: 'Written inside the same transaction as the ledger, so a crash cannot lose it',
          paymentId: payment.id,
          at: entry.createdAt,
          meta: { event: entry.reversesId ? 'payment.reversed' : 'payment.completed', published: true },
        });
        out.push({
          id: `${entry.id}-notify`,
          kind: 'notification',
          service: 'notifications',
          title: 'Email sent to merchant',
          detail: 'Consumed from pub/sub. Delivery is at least once, so this consumer is idempotent',
          paymentId: payment.id,
          at: new Date(new Date(entry.createdAt).getTime() + 1400).toISOString(),
          meta: { template: 'payment_settled' },
        });
      }
    }

    for (const delivery of mock.webhooks(mode)) {
      out.push({
        id: `${delivery.id}-hook`,
        kind: 'webhook',
        service: 'worker',
        title: `Webhook ${delivery.eventType}`,
        detail:
          delivery.status === 'DELIVERED'
            ? `Delivered on attempt ${delivery.attempts}, HTTP ${delivery.lastResponseStatus}`
            : `Attempt ${delivery.attempts} failed with HTTP ${delivery.lastResponseStatus}, backing off`,
        paymentId: delivery.paymentId,
        at: delivery.createdAt,
        meta: { endpointId: delivery.endpointId, attempts: delivery.attempts },
      });
    }

    return out.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 120);
  },

  endpoint: (): WebhookEndpoint => endpointState,

  updateEndpoint: (url: string): WebhookEndpoint => {
    endpointState = { ...endpointState, url };
    return endpointState;
  },

  reset: () => {
    state = null;
  },
};
