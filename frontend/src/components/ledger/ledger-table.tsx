'use client';

import { ArrowDownLeft, ArrowUpRight, Undo2 } from 'lucide-react';
import { TableSkeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { formatCrypto, sumMinor } from '@/lib/format/money';
import { formatDateTime } from '@/lib/format/date';
import { truncateMiddle, cn } from '@/lib/utils';
import type { AccountKind, LedgerEntry } from '@/types';

// The API sends the account id and its kind, because a uuid on its own tells
// a reader nothing
const ACCOUNT_LABEL: Record<AccountKind, string> = {
  MERCHANT_BALANCE: 'Merchant balance',
  GATEWAY_WALLET: 'Gateway wallet',
  FEES: 'Fees',
};

// This is the screen the whole project exists to show. Anyone can render a
// status badge. Showing both halves of every movement, that they cancel to
// zero, and that a reversal is a new pair rather than a delete, is the part
// that says this was built by someone who has thought about money

function signedTotal(entries: LedgerEntry[]): string {
  const credits = sumMinor(entries.filter((e) => e.direction === 'CREDIT').map((e) => e.amount));
  const debits = sumMinor(entries.filter((e) => e.direction === 'DEBIT').map((e) => e.amount));
  return (BigInt(credits) - BigInt(debits)).toString();
}

export function LedgerTable({ entries, loading }: { entries: LedgerEntry[]; loading?: boolean }) {
  if (loading) return <TableSkeleton rows={6} cols={4} />;

  if (entries.length === 0) {
    return (
      <EmptyState
        title="No ledger entries"
        description="Entries are written when a payment reaches its confirmation threshold and settles."
      />
    );
  }

  // Grouped by transfer, because a single entry on its own is meaningless. The
  // pair is the unit
  const groups = new Map<string, LedgerEntry[]>();
  for (const entry of entries) {
    const bucket = groups.get(entry.transferId) ?? [];
    bucket.push(entry);
    groups.set(entry.transferId, bucket);
  }

  return (
    <div className="divide-y divide-line">
      {[...groups.entries()].map(([transferId, group]) => {
        const balanced = signedTotal(group) === '0';
        const isReversal = group.some((e) => e.reversesId);

        return (
          <div key={transferId} className="px-4 py-4 sm:px-5">
            <div className="mb-2.5 flex flex-wrap items-center gap-2">
              <span className="mono text-xs text-ink-subtle">
                transfer {truncateMiddle(transferId, 12, 6)}
              </span>
              {isReversal && (
                <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
                  style={{ backgroundColor: 'var(--special-bg)', color: 'var(--special-fg)' }}>
                  <Undo2 className="size-3" aria-hidden />
                  Reversal
                </span>
              )}
              <span className="ml-auto text-xs text-ink-subtle">{formatDateTime(group[0].createdAt)}</span>
            </div>

            <div className="overflow-hidden rounded-well border border-line">
              {group.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center gap-3 border-b border-line bg-surface px-3 py-2.5 last:border-b-0"
                >
                  <span
                    className={cn(
                      'grid size-6 shrink-0 place-items-center rounded-full',
                      entry.direction === 'CREDIT'
                        ? 'bg-[var(--ok-bg)] text-[var(--ok-fg)]'
                        : 'bg-[var(--neutral-bg)] text-[var(--neutral-fg)]',
                    )}
                    aria-hidden
                  >
                    {entry.direction === 'CREDIT' ? (
                      <ArrowDownLeft className="size-3.5" />
                    ) : (
                      <ArrowUpRight className="size-3.5" />
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-ink">
                      {ACCOUNT_LABEL[entry.accountKind]} {entry.currency}
                    </p>
                    <p className="text-xs text-ink-subtle">
                      {entry.direction === 'CREDIT' ? 'Credit' : 'Debit'}
                      {entry.reversesId ? ` · reverses ${truncateMiddle(entry.reversesId, 8, 4)}` : ''}
                    </p>
                  </div>

                  <span className="mono shrink-0 text-sm text-ink">
                    {entry.direction === 'CREDIT' ? '+' : '−'}
                    {formatCrypto(entry.amount, entry.currency)} {entry.currency}
                  </span>
                </div>
              ))}
            </div>

            <p
              className={cn(
                'mt-2 text-xs',
                balanced ? 'text-ink-subtle' : 'font-medium text-[var(--bad-fg)]',
              )}
            >
              {balanced
                ? 'Credits and debits sum to zero, so no money was created or destroyed'
                : 'This transfer does not sum to zero, which is a bug'}
            </p>
          </div>
        );
      })}
    </div>
  );
}
