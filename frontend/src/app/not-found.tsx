import Link from 'next/link';
import { Logo } from '@/components/layout/logo';

// Both doors, because this page cannot tell who is reading it. An unmatched url
// is as likely to be a merchant who mistyped one of their own payment ids as it
// is somebody who has never been here
export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-surface-muted px-4 py-10 text-center">
      <Logo className="mb-8" />

      <p className="mono text-xs uppercase tracking-[0.14em] text-ink-faint">404</p>
      <h1 className="mt-3 text-xl font-semibold text-ink">There is nothing at this address</h1>
      <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-subtle">
        The link may be wrong, or it may have pointed at a demo workspace that has since expired.
      </p>

      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/"
          className="inline-flex h-11 items-center rounded-full bg-ink px-5 text-sm font-semibold text-on-accent transition-transform hover:scale-[1.03]"
        >
          Back to the start
        </Link>
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
