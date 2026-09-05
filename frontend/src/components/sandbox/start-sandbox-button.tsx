'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Loader2 } from 'lucide-react';
import { ApiError } from '@/lib/api/client';
import { getSession } from '@/lib/api/auth';
import { createSandbox } from '@/lib/api/sandbox';

const RATE_LIMITED = 'A few sandboxes came from here already. Try in an hour.';

const FAILED = 'Could not open a sandbox just now. Try again.';

// One click has to end with a stranger inside a dashboard that has data in it,
// so this creates the account, seeds it and signs in before it navigates
export function StartSandboxButton({
  className,
  label = 'Open the demo',
}: {
  className: string;
  label?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  async function open() {
    if (busy) return;

    setBusy(true);
    setFailed(null);

    try {
      // Anyone already signed in keeps the account they signed in to
      // Otherwise clicking this would swap a real merchant's cookie for a
      // sandbox one and look exactly like being logged out
      const existing = await getSession();

      if (!existing) {
        await createSandbox();
      }

      router.push('/dashboard');
    } catch (error) {
      setBusy(false);
      setFailed(error instanceof ApiError && error.status === 429 ? RATE_LIMITED : FAILED);
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-2">
      <button type="button" onClick={open} disabled={busy} className={className}>
        {busy ? (
          <>
            Setting up your workspace
            <Loader2 className="size-4 animate-spin" aria-hidden />
          </>
        ) : (
          <>
            {label}
            <ArrowRight className="size-4" aria-hidden />
          </>
        )}
      </button>

      {failed && (
        <span
          role="alert"
          className="max-w-3xs rounded-well px-3 py-2 text-xs leading-snug"
          style={{ backgroundColor: 'var(--bad-bg)', color: 'var(--bad-fg)' }}
        >
          {failed}
        </span>
      )}
    </span>
  );
}
