import type { ChainTx, Payment, PaymentTimelineItem, WebhookDelivery } from '@/types';

// The detail page timeline is built from the rows themselves rather than from a
// separate events table. If the timeline and the data ever disagree, the data
// wins, because there is only one source
export function buildTimeline(
  payment: Payment,
  chainTxs: ChainTx[],
  webhooks: WebhookDelivery[],
): PaymentTimelineItem[] {
  const items: PaymentTimelineItem[] = [
    {
      label: 'Payment created',
      at: payment.createdAt,
      detail: `Quote locked until ${new Date(payment.expiresAt).toLocaleTimeString()}`,
      tone: 'neutral',
    },
  ];

  for (const tx of chainTxs) {
    items.push({
      label: 'Transaction seen on chain',
      at: tx.seenAt,
      detail: `${tx.confirmations} confirmation${tx.confirmations === 1 ? '' : 's'}`,
      tone: 'progress',
    });
  }

  if (payment.status === 'PAID' || payment.status === 'REVERSED') {
    items.push({
      label: 'Settled to the ledger',
      at: payment.updatedAt,
      detail: 'Two entries written inside one transaction, balance locked with FOR UPDATE',
      tone: 'good',
    });
  }

  if (payment.status === 'UNDERPAID') {
    items.push({
      label: 'Underpaid',
      at: payment.updatedAt,
      detail: 'Confirmed, but less arrived than was quoted',
      tone: 'bad',
    });
  }

  if (payment.status === 'EXPIRED') {
    items.push({ label: 'Quote expired', at: payment.expiresAt, detail: 'Nothing arrived in the window', tone: 'bad' });
  }

  if (payment.status === 'REVERSED') {
    items.push({
      label: 'Reversed',
      at: payment.updatedAt,
      detail: 'A compensating pair was written. Nothing was deleted',
      tone: 'bad',
    });
  }

  for (const delivery of webhooks) {
    items.push({
      label: `Webhook ${delivery.event}`,
      at: delivery.createdAt,
      detail:
        delivery.status === 'DELIVERED'
          ? `Delivered, HTTP ${delivery.responseCode}`
          : `Attempt ${delivery.attempts} failed with HTTP ${delivery.responseCode}`,
      tone: delivery.status === 'DELIVERED' ? 'good' : 'bad',
    });
  }

  return items.sort((a, b) => a.at.localeCompare(b.at));
}
