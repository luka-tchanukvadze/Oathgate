import type { Insight, Payment } from '@/types';

// Rules over the merchant's own rows, in the browser, from data already on
// screen. No endpoint, so there is nothing that can tell the merchant one thing
// here and a different thing on the payments table
//
// Counted rather than generated, and that is the choice rather than a stage on
// the way to something better. A wrong filter in the search box is visible in
// the line above the results, and a wrong number here would look exactly like a
// right one

const MINUTE = 60_000;

// The window every figure on that screen is scoped to, and the number the
// page prints next to them
export const WINDOW_DAYS = 14;

// Applied here rather than at the call site, so the cards and the summary
// printed under them can never be counted over different sets of rows
export function withinWindow(payments: Payment[]): Payment[] {
  const cutoff = Date.now() - WINDOW_DAYS * 24 * 60 * MINUTE;

  return payments.filter((p) => new Date(p.createdAt).getTime() >= cutoff);
}

// Median rather than mean. One payment left open over a weekend drags an
// average into nonsense and says nothing about the usual case
function medianMinutes(values: number[]): number | null {
  if (values.length === 0) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);

  return sorted.length % 2 === 0
    ? Math.round((sorted[middle - 1] + sorted[middle]) / 2)
    : Math.round(sorted[middle]);
}

// Created to settled, which is the wait a customer actually feels
// Exported because the page prints this number next to the cards, and two
// copies of the same arithmetic is how a screen ends up disagreeing with itself
export function medianSettlementMinutes(payments: Payment[]): number | null {
  const waits = payments
    .filter((p) => p.status === 'PAID')
    .map((p) => (new Date(p.updatedAt).getTime() - new Date(p.createdAt).getTime()) / MINUTE);

  return medianMinutes(waits);
}

export function deriveInsights(all: Payment[]): Insight[] {
  const payments = withinWindow(all);
  const settled = payments.filter((p) => p.status === 'PAID');
  const expired = payments.filter((p) => p.status === 'EXPIRED').length;
  const underpaid = payments.filter((p) => p.status === 'UNDERPAID').length;
  const median = medianSettlementMinutes(payments);

  return [
    {
      id: 'volume',
      headline: `${settled.length} of ${payments.length} payments settled`,
      body:
        expired === 0
          ? 'Nothing expired with a customer still trying to pay it.'
          : `${expired} quote${expired === 1 ? '' : 's'} ran out with nothing arriving. A checkout window shorter than customers need would look like this, and so would customers changing their mind. The counts do not tell the two apart.`,
      tone: expired > settled.length / 3 ? 'warn' : 'good',
    },
    {
      id: 'underpaid',
      headline:
        underpaid > 0
          ? `${underpaid} payment${underpaid === 1 ? '' : 's'} came in short`
          : 'No underpayments',
      body:
        underpaid > 0
          ? 'One cause worth ruling out first is a wallet deducting the network fee from the amount instead of adding it, which lands a few hundred satoshis short. Compare the shortfall against the fee before treating these as failures.'
          : 'Every confirmed payment covered its quoted amount in full.',
      tone: underpaid > 0 ? 'warn' : 'good',
    },
    {
      id: 'timing',
      headline:
        median === null
          ? 'Nothing has settled yet'
          : `Payments settling about ${median} minute${median === 1 ? '' : 's'} after they are created`,
      body:
        median === null
          ? 'Settlement timings appear once the first payment confirms.'
          : 'Median from the request to the block that confirms it. That wait is the chain, not the gateway, and raising the confirmation threshold multiplies it.',
      tone: 'neutral',
    },
  ];
}
