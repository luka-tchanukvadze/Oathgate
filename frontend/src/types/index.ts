// These match what the API actually returns, field for field. If a field is
// not in a response mapper in backend/apps/api, it is not here either

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

export type AccountKind = 'MERCHANT_BALANCE' | 'GATEWAY_WALLET' | 'FEES';

// Every amount crossing this boundary is a STRING of a whole number in the
// currency's smallest unit. Never a JS number. 10.50 GEL arrives as "1050",
// 0.001 BTC arrives as "100000" satoshis. Parsing one of these into a number
// is how a ledger quietly loses money
export type MinorUnits = string;

export interface Payment {
  id: string;
  status: PaymentStatus;
  mode: KeyMode;
  reference: string | null;
  fiatAmount: MinorUnits;
  fiatCurrency: string;
  cryptoAmount: MinorUnits;
  cryptoCurrency: string;
  quotedRate: string;
  address: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
}

// No paymentId. These only ever arrive attached to the payment they belong to
export interface ChainTx {
  id: string;
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
  // The account is a uuid, which tells a reader nothing, so the kind comes too
  accountKind: AccountKind;
  direction: EntryDirection;
  amount: MinorUnits;
  currency: string;
  paymentId: string | null;
  reversesId: string | null;
  createdAt: string;
}

export interface Account {
  id: string;
  kind: AccountKind;
  currency: string;
  mode: KeyMode;
  balance: MinorUnits;
  updatedAt: string;
}

export type WebhookStatus = 'PENDING' | 'DELIVERED' | 'FAILED' | 'DEAD_LETTER';

export interface WebhookDelivery {
  id: string;
  // Read through the outbox event the delivery came from
  paymentId: string | null;
  endpointId: string;
  mode: KeyMode;
  eventType: string;
  status: WebhookStatus;
  attempts: number;
  maxAttempts: number;
  lastResponseStatus: number | null;
  nextAttemptAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
}

export interface WebhookAttempt {
  attempt: number;
  responseStatus: number | null;
  error: string | null;
  durationMs: number;
  createdAt: string;
}

// The payload is only on the detail response, because it is the one field that
// can be large
export interface WebhookDeliveryDetail extends WebhookDelivery {
  payload: Record<string, unknown>;
  attemptLog: WebhookAttempt[];
}

export interface WebhookEndpoint {
  id: string;
  mode: KeyMode;
  url: string;
  secretPrefix: string;
  events: string[];
  disabledAt: string | null;
  createdAt: string;
}

// hasMore, not a total. The API pages by cursor and never counts the whole
// table, so there is no total to report
export interface Page<T> {
  data: T[];
  hasMore: boolean;
}

export interface PaymentTimelineItem {
  label: string;
  at: string;
  detail?: string;
  tone: 'neutral' | 'progress' | 'good' | 'bad';
}

// Nothing below here has an endpoint yet, so these shapes are mine to choose
// and the sample data is the only thing that produces them

export interface Merchant {
  id: string;
  email: string;
  name: string;
  settlementCurrency: string;
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

export interface Insight {
  id: string;
  headline: string;
  body: string;
  tone: 'neutral' | 'good' | 'warn';
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

// What the public checkout route answers with. A narrower payment: no mode, no
// merchantId, nothing about the merchant's other business
export interface Checkout {
  id: string;
  status: PaymentStatus;
  merchantName: string;
  reference: string | null;
  fiatAmount: string;
  fiatCurrency: string;
  cryptoAmount: string;
  cryptoCurrency: string;
  address: string;
  expiresAt: string;
  createdAt: string;
  updatedAt: string;
  confirmations: number;
  canSimulate: boolean;
}
