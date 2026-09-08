'use client';

import Link from 'next/link';
import { Logo } from '@/components/layout/logo';

// Next's default for an unhandled error is an unstyled stack trace in
// development and a bare page in production. Neither says what to do next
//
// The error itself is not shown. A stack trace tells a stranger which library
// versions I run, and tells a merchant nothing they can act on
export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-surface-muted px-4 py-10 text-center">
      <Logo className="mb-8" />

      <h1 className="text-xl font-semibold text-ink">Something went wrong on this page</h1>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-subtle">
        Nothing you have done is lost. Payments, balances and ledger entries are recorded on the
        server, not here.
      </p>

      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="inline-flex h-11 items-center rounded-full bg-ink px-5 text-sm font-semibold text-on-accent transition-transform hover:scale-[1.03]"
        >
          Try again
        </button>
        <Link
          href="/dashboard"
          className="shadow-card inline-flex h-11 items-center rounded-full bg-surface px-5 text-sm font-medium text-ink transition-colors hover:bg-canvas"
        >
          Go to the dashboard
        </Link>
      </div>
    </div>
  );
}
