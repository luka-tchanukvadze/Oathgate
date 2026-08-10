// These mirror the Prisma schema in backend/prisma/schema.prisma. When the real
// API lands, the shapes should already match and only the transport changes

export type PaymentStatus =
  | 'PENDING'
  | 'CONFIRMING'
  | 'PAID'
  | 'UNDERPAID'
  | 'EXPIRED'
  | 'REVERSED'
  | 'FAILED';

export type KeyMode = 'TEST' | 'LIVE';

export type EntryDirection = 'DEBIT' | 'CREDIT';

// Every amount crossing this boundary is a STRING of a whole number in the
// currency's smallest unit. Never a JS number. 10.50 GEL arrives as "1050",
// 0.001 BTC arrives as "100000" satoshis. Parsing one of these into a number
// is how a ledger quietly loses money
export type MinorUnits = string;

export interface Merchant {
  id: string;
  email: string;
  name: string;
  settlementCurrency: string;
}

export interface Payment {
  id: string;
  merchantId: string;
  mode: KeyMode;
  reference: string | null;
  fiatAmount: MinorUnits;
  fiatCurrency: string;
  cryptoAmount: MinorUnits;
  cryptoCurrency: string;
  quotedRate: string;
  address: string;
  derivationIndex: number;
  status: PaymentStatus;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface ChainTx {
  id: string;
  paymentId: string;
  txid: string;
  blockHash: string | null;
  amount: MinorUnits;
  currency: string;
  confirmations: number;
  seenAt: string;
}

export interface LedgerEntry {
  id: string;
  transferId: string;
  accountId: string;
  accountLabel: string;
  direction: EntryDirection;
  amount: MinorUnits;
  currency: string;
  paymentId: string | null;
  reversesId: string | null;
  createdAt: string;
}

export interface Account {
  id: string;
  currency: string;
  mode: KeyMode;
  balance: MinorUnits;
}

export interface ApiKey {
  id: string;
  keyPrefix: string;
  mode: KeyMode;
  name: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
  createdAt: string;
}

// Only ever returned once, at creation. Nothing stores this
export interface ApiKeyWithSecret extends ApiKey {
  secret: string;
}

export type WebhookStatus = 'PENDING' | 'DELIVERED' | 'FAILED' | 'DEAD_LETTER';

export interface WebhookDelivery {
  id: string;
  paymentId: string;
  event: string;
  url: string;
  status: WebhookStatus;
  attempts: number;
  responseCode: number | null;
  signature: string;
  payload: Record<string, unknown>;
  nextRetryAt: string | null;
  createdAt: string;
}

export interface PaymentTimelineItem {
  label: string;
  at: string;
  detail?: string;
  tone: 'neutral' | 'progress' | 'good' | 'bad';
}

export interface Insight {
  id: string;
  headline: string;
  body: string;
  tone: 'neutral' | 'good' | 'warn';
}

export interface Paginated<T> {
  data: T[];
  total: number;
}

// The developer log. This is where everything the plan calls invisible actually
// shows up: outbox rows, queue jobs, idempotency replays, notification sends.
// None of those deserve a nav item of their own, they deserve a line here
export type EventKind =
  | 'api_request'
  | 'idempotency_replay'
  | 'outbox'
  | 'queue_job'
  | 'webhook'
  | 'notification'
  | 'ledger';

export type ServiceName = 'api' | 'worker' | 'notifications';

export interface SystemEvent {
  id: string;
  kind: EventKind;
  service: ServiceName;
  title: string;
  detail: string;
  paymentId: string | null;
  at: string;
  meta?: Record<string, unknown>;
}

export interface WebhookEndpoint {
  id: string;
  url: string;
  secretPrefix: string;
  events: string[];
  createdAt: string;
}
