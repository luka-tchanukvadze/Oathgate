import type { LedgerEntry, Payment, SystemEvent, WebhookDelivery } from '@/types';

// The developer log is a projection, not a table
//
// The API has no events endpoint and does not need one. Every line here is
// already implied by a row somewhere else, so building it in the browser keeps
// one source of truth and saves a controller that could only ever disagree
// with the payments screen

// The rule: a line goes in only if a row proves it happened. The mock invented
// notification emails and idempotent replays out of a character code, and none
// of that survives contact with real data

export interface EventSources {
  payments: Payment[];
  ledger: LedgerEntry[];
  deliveries: WebhookDelivery[];
}

export function deriveEvents({ payments, ledger, deliveries }: EventSources): SystemEvent[] {
  const events: SystemEvent[] = [];

  for (const payment of payments) {
    events.push({
      id: `${payment.id}-request`,
      kind: 'api_request',
      service: 'api',
      title: 'POST /v1/payments',
      detail: `201 Created, ${payment.fiatAmount} ${payment.fiatCurrency} quoted at ${payment.quotedRate}`,
      paymentId: payment.id,
      at: payment.createdAt,
      meta: { status: 201, mode: payment.mode },
    });
  }

  // One line per pair, not two. A credit and its matching debit are one
  // movement, and the credit is the side the merchant cares about
  for (const entry of ledger) {
    if (entry.direction !== 'CREDIT') continue;

    events.push({
      id: `${entry.id}-ledger`,
      kind: 'ledger',
      service: 'worker',
      title: entry.reversesId ? 'Reversal pair written' : 'Ledger pair written',
      detail:
        'Balance row locked with SELECT ... FOR UPDATE, both entries committed in one transaction',
      paymentId: entry.paymentId,
      at: entry.createdAt,
      meta: { transferId: entry.transferId, amount: entry.amount },
    });

    events.push({
      id: `${entry.id}-outbox`,
      kind: 'outbox',
      service: 'worker',
      title: 'OutboxEvent inserted',
      detail: 'Written inside the same transaction as the ledger, so a crash cannot lose it',
      paymentId: entry.paymentId,
      at: entry.createdAt,
      meta: { event: entry.reversesId ? 'payment.reversed' : 'payment.completed' },
    });
  }

  for (const delivery of deliveries) {
    events.push({
      id: `${delivery.id}-webhook`,
      kind: 'webhook',
      service: 'worker',
      title: `Webhook ${delivery.eventType}`,
      detail:
        delivery.status === 'DELIVERED'
          ? `Delivered on attempt ${delivery.attempts}, HTTP ${delivery.lastResponseStatus}`
          : `Attempt ${delivery.attempts} of ${delivery.maxAttempts}, backing off`,
      paymentId: delivery.paymentId,
      at: delivery.createdAt,
      meta: { endpointId: delivery.endpointId, attempts: delivery.attempts },
    });
  }

  return events.sort((a, b) => b.at.localeCompare(a.at));
}
