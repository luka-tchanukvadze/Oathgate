'use client';

import Link from 'next/link';
import { ChevronDown, ChevronRight, ChevronUp } from 'lucide-react';
import { StatusBadge } from '@/components/ui/status-badge';
import { TableSkeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/ui/empty-state';
import { formatFiat, formatCrypto } from '@/lib/format/money';
import { formatRelative } from '@/lib/format/date';
import { cn } from '@/lib/utils';
import type { Payment } from '@/types';

export type SortKey = 'created' | 'amount' | 'status';
export type SortDirection = 'asc' | 'desc';

export interface Sort {
  key: SortKey;
  direction: SortDirection;
}

// Sorting lives here rather than in the page, because the header cells are what
// drive it. Amount sorts in BigInt so a large payment cannot sort wrongly
export function sortPayments(rows: Payment[], sort: Sort): Payment[] {
  const factor = sort.direction === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (sort.key === 'amount') {
      const left = BigInt(a.fiatAmount);
      const right = BigInt(b.fiatAmount);
      return left === right ? 0 : (left < right ? -1 : 1) * factor;
    }
    if (sort.key === 'status') return a.status.localeCompare(b.status) * factor;
    return a.createdAt.localeCompare(b.createdAt) * factor;
  });
}

function SortHeader({
  label,
  column,
  sort,
  onSort,
  align = 'left',
}: {
  label: string;
  column: SortKey;
  sort: Sort;
  onSort: (key: SortKey) => void;
  align?: 'left' | 'right';
}) {
  const active = sort.key === column;
  return (
    <th
      scope="col"
      // aria-sort goes on the columnheader, which is the th. Putting it on the
      // button inside is invalid, the button role does not support it
      aria-sort={active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}
      className={cn('px-5 py-2 font-medium', align === 'right' && 'text-right')}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className={cn(
          'inline-flex items-center gap-1 rounded transition-colors hover:text-ink',
          active ? 'text-ink' : 'text-ink-subtle',
        )}
      >
        {label}
        {active &&
          (sort.direction === 'asc' ? (
            <ChevronUp className="size-3" aria-hidden />
          ) : (
            <ChevronDown className="size-3" aria-hidden />
          ))}
      </button>
    </th>
  );
}

export function PaymentsTable({
  payments,
  loading,
  emptyAction,
  emptyCode,
  filtered,
  sort,
  onSort,
}: {
  payments: Payment[];
  loading?: boolean;
  emptyAction?: React.ReactNode;
  emptyCode?: string;
  filtered?: boolean;
  sort?: Sort;
  onSort?: (key: SortKey) => void;
}) {
  if (loading) return <TableSkeleton rows={8} cols={5} />;

  // An account with no payments and a filter that matches nothing are different
  // problems and need different words
  if (payments.length === 0) {
    return filtered ? (
      <EmptyState
        title="No payments match these filters"
        description="Try a wider date range, or clear the filters to see everything."
      />
    ) : (
      <EmptyState
        title="No payments yet"
        description="Create one and simulate a customer paying it to watch the whole flow run, or make the first from your terminal."
        action={emptyAction}
        code={emptyCode}
      />
    );
  }

  const sortable = sort && onSort;

  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full">
          <thead>
            <tr className="border-b border-line text-left text-xs text-ink-subtle">
              {sortable ? (
                <SortHeader label="Amount" column="amount" sort={sort} onSort={onSort} />
              ) : (
                <th scope="col" className="px-5 py-2.5 font-medium">Amount</th>
              )}
              {sortable ? (
                <SortHeader label="Status" column="status" sort={sort} onSort={onSort} />
              ) : (
                <th scope="col" className="px-5 py-2.5 font-medium">Status</th>
              )}
              <th scope="col" className="px-5 py-2.5 font-medium">Reference</th>
              {sortable ? (
                <SortHeader label="Created" column="created" sort={sort} onSort={onSort} align="right" />
              ) : (
                <th scope="col" className="px-5 py-2.5 text-right font-medium">Created</th>
              )}
            </tr>
          </thead>
          <tbody>
            {payments.map((payment) => (
              <tr key={payment.id} className="border-b border-line last:border-b-0 hover:bg-surface-muted">
                {/* Four columns, not six. The payment id and the crypto amount
                    were both competing with the number a merchant is actually
                    scanning for. The id is searchable and lives on the detail
                    page, and the crypto amount sits under the fiat one where it
                    reads as a footnote instead of a column */}
                <td className="py-3 pl-5 pr-5">
                  <Link href={`/dashboard/payments/${payment.id}`} className="block">
                    <span className="num text-sm font-medium text-ink">
                      {formatFiat(payment.fiatAmount, payment.fiatCurrency)}
                    </span>{' '}
                    <span className="text-xs text-ink-subtle">{payment.fiatCurrency}</span>
                    <span className="mono mt-0.5 block text-xs text-ink-faint">
                      {formatCrypto(payment.cryptoAmount, payment.cryptoCurrency)} {payment.cryptoCurrency}
                    </span>
                  </Link>
                </td>
                <td className="px-5 py-3">
                  <StatusBadge status={payment.status} />
                </td>
                <td className="max-w-56 truncate px-5 py-3 text-sm text-ink-muted">{payment.reference ?? '—'}</td>
                <td className="px-5 py-3 text-right text-xs text-ink-subtle">
                  {formatRelative(payment.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Stacked on phones. Six columns at 380px is unreadable, and scrolling a
          list sideways is worse than reflowing it */}
      <ul className="divide-y divide-line md:hidden">
        {payments.map((payment) => (
          <li key={payment.id}>
            <Link
              href={`/dashboard/payments/${payment.id}`}
              className="flex items-center gap-3 px-4 py-3.5 hover:bg-surface-muted"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <span className="num text-sm font-medium text-ink">
                    {formatFiat(payment.fiatAmount, payment.fiatCurrency)} {payment.fiatCurrency}
                  </span>
                  <StatusBadge status={payment.status} />
                </div>
                <p className="mono mt-1 truncate text-xs text-ink-subtle">
                  {formatCrypto(payment.cryptoAmount, payment.cryptoCurrency)} {payment.cryptoCurrency}
                </p>
                {payment.reference && (
                  <p className="mt-0.5 truncate text-xs text-ink-subtle">{payment.reference}</p>
                )}
                <p className="mt-0.5 text-xs text-ink-faint">{formatRelative(payment.createdAt)}</p>
              </div>
              <ChevronRight className="size-4 shrink-0 text-ink-faint" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
