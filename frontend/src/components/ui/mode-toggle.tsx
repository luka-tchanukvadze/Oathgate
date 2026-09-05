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
      className={cn('inline-flex h-10 items-center rounded-full bg-surface-muted p-1', className)}
    >
      {/* Painted from mode, never hardcoded
          Hardcoding it meant a stale live mode showed a Testnet pill while every
          record it wrote said LIVE, which is the display disagreeing with the
          books */}
      <span
        className="inline-flex h-8 items-center rounded-full px-3 text-xs font-semibold"
        style={
          mode === 'TEST'
            ? { backgroundColor: 'var(--warn-bg)', color: 'var(--warn-fg)' }
            : { color: 'var(--ink-faint)' }
        }
      >
        Testnet
      </span>

      <button
        type="button"
        onClick={onLockedClick}
        aria-disabled="true"
        title="Mainnet is not activated"
        className="inline-flex h-8 items-center gap-1 rounded-full px-3 text-xs font-semibold text-ink-faint hover:text-ink-subtle"
      >
        <Lock className="size-3" aria-hidden />
        Mainnet
      </button>
      <span className="sr-only">Currently in {mode.toLowerCase()} mode</span>
    </div>
  );
}
