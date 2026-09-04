import { cn } from '@/lib/utils';
import type { PaymentStatus, WebhookStatus } from '@/types';

// The only place colour is allowed to mean something. Green settled, yellow
// waiting, blue in progress, red wrong, grey over, purple undone. Everything
// else in this product is ink on white, which is what keeps these readable
const PAYMENT_STYLES: Record<PaymentStatus, { label: string; tone: string }> = {
  PENDING: { label: 'Pending', tone: 'warn' },
  CONFIRMING: { label: 'Confirming', tone: 'info' },
  PAID: { label: 'Paid', tone: 'ok' },
  UNDERPAID: { label: 'Underpaid', tone: 'bad' },
  EXPIRED: { label: 'Expired', tone: 'neutral' },
  REVERSED: { label: 'Reversed', tone: 'special' },
  FAILED: { label: 'Failed', tone: 'bad' },
};

const WEBHOOK_STYLES: Record<WebhookStatus, { label: string; tone: string }> = {
  PENDING: { label: 'Queued', tone: 'warn' },
  DELIVERED: { label: 'Delivered', tone: 'ok' },
  FAILED: { label: 'Retrying', tone: 'warn' },
  DEAD_LETTER: { label: 'Dead letter', tone: 'bad' },
};

function Pill({ label, tone, pulse, className }: { label: string; tone: string; pulse?: boolean; className?: string }) {
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium', className)}
      style={{ backgroundColor: `var(--${tone}-bg)`, color: `var(--${tone}-fg)` }}
    >
      <span
        className={cn('size-1.5 rounded-full', pulse && 'animate-pulse')}
        style={{ backgroundColor: 'currentColor' }}
        aria-hidden
      />
      {label}
    </span>
  );
}

export function StatusBadge({ status, className }: { status: PaymentStatus; className?: string }) {
  const { label, tone } = PAYMENT_STYLES[status];
  return <Pill label={label} tone={tone} pulse={status === 'CONFIRMING'} className={className} />;
}

export function WebhookBadge({ status, className }: { status: WebhookStatus; className?: string }) {
  const { label, tone } = WEBHOOK_STYLES[status];
  return <Pill label={label} tone={tone} className={className} />;
}

export function ModeTag({ mode }: { mode: 'TEST' | 'LIVE' }) {
  return (
    <span
      className="rounded-full px-2 py-0.5 text-2xs font-semibold uppercase tracking-wide"
      style={{
        backgroundColor: mode === 'TEST' ? 'var(--warn-bg)' : 'var(--neutral-bg)',
        color: mode === 'TEST' ? 'var(--warn-fg)' : 'var(--neutral-fg)',
      }}
    >
      {mode}
    </span>
  );
}
