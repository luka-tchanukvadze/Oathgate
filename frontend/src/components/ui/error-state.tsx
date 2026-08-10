'use client';

import { AlertTriangle, RotateCcw } from 'lucide-react';
import { Button } from './button';
import { cn } from '@/lib/utils';

// A failed request used to look identical to an empty account, which on a
// balance screen is the worst possible ambiguity. This says what went wrong and
// offers the one action that might fix it
export function ErrorState({
  title = 'Could not load this',
  error,
  onRetry,
  retrying,
  className,
}: {
  title?: string;
  error?: unknown;
  onRetry?: () => void;
  retrying?: boolean;
  className?: string;
}) {
  const detail = error instanceof Error ? error.message : 'The request did not come back.';

  return (
    <div className={cn('flex flex-col items-center gap-2 px-6 py-12 text-center', className)}>
      <span
        className="grid size-9 place-items-center rounded-full"
        style={{ backgroundColor: 'var(--bad-bg)', color: 'var(--bad-fg)' }}
        aria-hidden
      >
        <AlertTriangle className="size-4" />
      </span>
      <p className="text-sm font-medium text-ink">{title}</p>
      <p className="max-w-md text-sm text-ink-subtle">{detail}</p>
      {onRetry && (
        <Button variant="secondary" className="mt-3" onClick={onRetry} loading={retrying}>
          <RotateCcw className="size-3.5" aria-hidden />
          Try again
        </Button>
      )}
    </div>
  );
}

// The strip version, for when a screen already has data on it and a background
// refetch failed. Nothing is thrown away, the stale numbers stay visible and
// are labelled as stale
export function StaleBanner({ onRetry, retrying }: { onRetry: () => void; retrying?: boolean }) {
  return (
    <div
      className="mb-4 flex flex-wrap items-center gap-3 rounded-lg px-3.5 py-2.5"
      style={{ backgroundColor: 'var(--warn-bg)', color: 'var(--warn-fg)' }}
      role="status"
    >
      <AlertTriangle className="size-4 shrink-0" aria-hidden />
      <p className="min-w-0 flex-1 text-xs">
        Could not refresh. These numbers are the last ones that loaded successfully.
      </p>
      <button
        type="button"
        onClick={onRetry}
        disabled={retrying}
        className="shrink-0 rounded px-2 py-1 text-xs font-semibold underline underline-offset-2 disabled:opacity-50"
      >
        {retrying ? 'Retrying' : 'Retry'}
      </button>
    </div>
  );
}
