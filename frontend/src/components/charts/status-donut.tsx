'use client';

import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import type { PaymentStatus } from '@/types';

// Counts, not money, so no float rule to worry about here
export interface StatusSlice {
  status: PaymentStatus;
  label: string;
  count: number;
}

// Reuses the exact status tokens the badges use, so the donut and the table can
// never disagree about what green means
const TONE: Record<PaymentStatus, string> = {
  PAID: 'var(--ok-fg)',
  CONFIRMING: 'var(--info-fg)',
  PENDING: 'var(--warn-fg)',
  UNDERPAID: 'var(--bad-fg)',
  // Deliberately darker than UNDERPAID. Two identical reds made the two slices
  // impossible to tell apart, and they mean different things
  FAILED: '#7f1d1d',
  EXPIRED: 'var(--neutral-fg)',
  REVERSED: 'var(--special-fg)',
};

export function StatusDonut({ slices, total }: { slices: StatusSlice[]; total: number }) {
  const data = slices.filter((slice) => slice.count > 0);

  if (data.length === 0) {
    return <p className="py-8 text-center text-sm text-ink-faint">No payments yet</p>;
  }

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
      <div className="relative size-36 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              dataKey="count"
              nameKey="label"
              innerRadius="66%"
              outerRadius="100%"
              paddingAngle={2}
              strokeWidth={0}
              startAngle={90}
              endAngle={-270}
              isAnimationActive={false}
            >
              {data.map((slice) => (
                <Cell key={slice.status} fill={TONE[slice.status]} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>

        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="text-center">
            <p className="num text-xl font-semibold tracking-tight text-ink">{total}</p>
            <p className="text-2xs text-ink-faint">payments</p>
          </div>
        </div>
      </div>

      <ul className="min-w-0 flex-1 space-y-1.5">
        {data.map((slice) => (
          <li key={slice.status} className="flex items-center gap-2 text-sm">
            <span
              className="size-2 shrink-0 rounded-full"
              style={{ backgroundColor: TONE[slice.status] }}
              aria-hidden
            />
            <span className="min-w-0 flex-1 truncate text-ink-muted">{slice.label}</span>
            <span className="num shrink-0 text-ink">{slice.count}</span>
            <span className="num w-10 shrink-0 text-right text-xs text-ink-faint">
              {Math.round((slice.count / total) * 100)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
