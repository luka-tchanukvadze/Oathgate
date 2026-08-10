'use client';

import { Lock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { KeyMode } from '@/types';

// Labelled Testnet and Mainnet rather than Test and Live. Card gateways say
// "test" because their test mode really is fake, but a testnet is a real chain
// and calling it test made people assume the whole thing was simulated. The
// KeyMode enum and the sk_test_ prefixes stay as they are, this is display only
//
// Mainnet is present and locked. Settling real Bitcoin means holding customer
// funds, which needs custody and regulatory approval
export function ModeToggle({
  mode,
  onLockedClick,
  className,
}: {
  mode: KeyMode;
  onLockedClick: () => void;
  className?: string;
}) {
  return (
    <div
      role="group"
      aria-label="Environment"
      className={cn('inline-flex items-center rounded-md bg-surface-muted p-0.5', className)}
    >
      <span
        className="rounded px-3 py-1.5 text-xs font-semibold sm:px-2.5 sm:py-1"
        style={{ backgroundColor: 'var(--warn-bg)', color: 'var(--warn-fg)' }}
      >
        Testnet
      </span>

      <button
        type="button"
        onClick={onLockedClick}
        aria-disabled="true"
        title="Mainnet is not activated"
        className="inline-flex items-center gap-1 rounded px-3 py-1.5 text-xs font-semibold text-ink-faint hover:text-ink-subtle sm:px-2.5 sm:py-1"
      >
        <Lock className="size-3" aria-hidden />
        Mainnet
      </button>
      <span className="sr-only">Currently in {mode.toLowerCase()} mode</span>
    </div>
  );
}
