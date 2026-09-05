import type { Insight, Payment } from '@/types';

// Rules over the merchant's own rows, in the browser, from data already on
// screen. No endpoint, so there is nothing that can tell the merchant one thing
// here and a different thing on the payments table
//
// A model is connected later. When it is, it reads this same summary and never
// a reference or an address, so nothing a customer typed can reach a prompt

const MINUTE = 60_000;

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

export function deriveInsights(payments: Payment[]): Insight[] {
  const settled = payments.filter((p) => p.status === 'PAID');
  const expired = payments.filter((p) => p.status === 'EXPIRED').length;
  const underpaid = payments.filter((p) => p.status === 'UNDERPAID').length;

  // Created to settled, which is the wait a customer actually feels
  const waits = settled.map(
    (p) => (new Date(p.updatedAt).getTime() - new Date(p.createdAt).getTime()) / MINUTE,
  );
  const median = medianMinutes(waits);

  return [
    {
      id: 'volume',
      headline: `${settled.length} of ${payments.length} payments settled`,
      body:
        expired === 0
          ? 'Nothing expired with a customer still trying to pay it.'
          : `${expired} quote${expired === 1 ? '' : 's'} expired with nothing arriving, which usually means the checkout window is shorter than customers need rather than that they changed their mind.`,
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
          ? 'The shortfall looks like a wallet deducting the network fee from the amount instead of adding it. Worth a dust tolerance before treating these as failures.'
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
