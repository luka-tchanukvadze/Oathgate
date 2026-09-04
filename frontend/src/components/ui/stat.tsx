import { cn } from '@/lib/utils';
import { Skeleton } from './skeleton';

export function Stat({
  label,
  value,
  previous,
  delta,
  loading,
  className,
}: {
  label: string;
  value: React.ReactNode;
  previous?: string;
  delta?: number | null;
  loading?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('shadow-tile rounded-tile bg-surface px-5 py-4', className)}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-ink-subtle">{label}</p>
        {typeof delta === 'number' && !loading && (
          <span
            className="num rounded-full px-2 py-0.5 text-2xs font-semibold"
            style={{
              backgroundColor: delta >= 0 ? 'var(--ok-bg)' : 'var(--bad-bg)',
              color: delta >= 0 ? 'var(--ok-fg)' : 'var(--bad-fg)',
            }}
          >
            {delta >= 0 ? '+' : ''}
            {delta}%
          </span>
        )}
      </div>

      {loading ? (
        <Skeleton className="mt-2 h-7 w-24" />
      ) : (
        <p className="num mt-1.5 text-xl font-semibold tracking-tight text-ink">{value}</p>
      )}

      {previous && !loading && <p className="mt-1 text-xs text-ink-faint">{previous}</p>}
    </div>
  );
}
