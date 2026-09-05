'use client';

import { useEffect, useState } from 'react';
import { MIN_CONFIRMATIONS } from '@/lib/constants';
import { cn } from '@/lib/utils';

// A gateway is only interesting once you have watched one payment go all the
// way through, so the hero runs one instead of describing one
// Nothing here is fetched: it is a fixed script on a loop, and the same script
// is what the demo actually does

const REQUEST = [
  'curl -X POST https://api.oathgate.dev/v1/payments \\',
  '  -H "Authorization: Bearer sk_test_..." \\',
  '  -H "Idempotency-Key: 8c1f-4a20" \\',
  "  -d '{\"amount\": 1050, \"currency\": \"GEL\"}'",
].join('\n');

const ADDRESS = 'tb1q8xk2m9v4rj7wq3nz6ha0plc5dus2eg4tyx';
const SATS = '3 692';
const BLOCK = '2 584 119';

type Phase =
  | 'typing'
  | 'quoted'
  | 'mempool'
  | 'confirmed'
  | 'ledger'
  | 'webhook'
  | 'held';

const SEQUENCE: { phase: Phase; ms: number }[] = [
  { phase: 'typing', ms: 2100 },
  { phase: 'quoted', ms: 1500 },
  { phase: 'mempool', ms: 1900 },
  { phase: 'confirmed', ms: 1600 },
  { phase: 'ledger', ms: 1800 },
  { phase: 'webhook', ms: 1600 },
  { phase: 'held', ms: 2600 },
];

const INDEX = Object.fromEntries(
  SEQUENCE.map((entry, i) => [entry.phase, i]),
) as Record<Phase, number>;

export function LiveSettlement() {
  const [step, setStep] = useState(0);
  const [typed, setTyped] = useState(0);

  useEffect(() => {
    const id = setTimeout(() => {
      setStep(step + 1 >= SEQUENCE.length ? 0 : step + 1);
    }, SEQUENCE[step].ms);
    return () => clearTimeout(id);
  }, [step]);

  // Two characters a frame, so the whole request lands well inside its slot
  // even on a slow timer
  useEffect(() => {
    if (step !== INDEX.typing) {
      setTyped(REQUEST.length);
      return;
    }
    setTyped(0);
    const id = setInterval(() => {
      setTyped((n) => (n >= REQUEST.length ? n : n + 2));
    }, 18);
    return () => clearInterval(id);
  }, [step]);

  const reached = (phase: Phase) => step >= INDEX[phase];
  const status = reached('confirmed')
    ? 'Paid'
    : reached('mempool')
      ? 'Confirming'
      : 'Pending';

  return (
    // The loop is decoration to a screen reader: it would announce a new state
    // every second and a half and say nothing a sentence cannot say better
    <div className="hero-panel relative rounded-tile p-1.5" aria-hidden>
      {/* One bar for the whole lifecycle, so the eye has somewhere to sit
          while the log is still filling in */}
      <div className="absolute inset-x-1.5 top-1.5 h-0.5 overflow-hidden rounded-full bg-(--hero-line)">
        <div
          className="h-full rounded-full bg-(--hero-accent) transition-[width] duration-700 ease-out"
          style={{ width: `${((step + 1) / SEQUENCE.length) * 100}%` }}
        />
      </div>

      <div className="rounded-[0.75rem] bg-(--hero-well) px-4 py-3.5 pt-4">
        <div className="mb-2.5 flex items-center gap-2.5">
          <span className="hero-dot" aria-hidden />
          {/* leading-none, so the line box is the size of the letters
              Capitals have nothing below the baseline, so the empty descender
              space in a normal line box drags a centred dot below the text */}
          <span className="mono text-2xs uppercase leading-none tracking-[0.14em] text-(--hero-ink-faint)">
            POST /v1/payments
          </span>
        </div>

        {/* A hidden copy of the whole request holds the block open at its full
            height, so typing cannot grow it and push the panel down
            It wraps rather than scrolls, because a request cut off mid string
            teaches nothing */}
        <div className="relative">
          <pre
            aria-hidden
            className="mono invisible whitespace-pre-wrap wrap-break-word text-xs leading-relaxed"
          >
            {REQUEST}
          </pre>
          <pre className="mono absolute inset-0 whitespace-pre-wrap wrap-break-word text-xs leading-relaxed text-(--hero-ink-muted)">
            {REQUEST.slice(0, typed)}
            {typed < REQUEST.length && <span className="hero-caret" aria-hidden />}
          </pre>
        </div>
      </div>

      {/* The space is held whether or not the quote has arrived, so the panel
          is the same height on every pass and the page never jumps */}
      <div
        className={cn(
          'px-4 pt-4 transition-all duration-500',
          reached('quoted')
            ? 'translate-y-0 opacity-100'
            : 'translate-y-1 opacity-0',
        )}
      >
        {/* items-center, not items-baseline
            The badge is a pill with its own padding, so sitting it on the
            baseline of a 30px number hangs it off the bottom */}
        <div className="flex items-center justify-between gap-3">
          <p
            className={cn(
              'num text-3xl font-semibold tracking-tight transition-colors duration-500',
              reached('confirmed')
                ? 'text-(--hero-ok)'
                : 'text-(--hero-ink)',
            )}
          >
            10.50 <span className="text-lg font-medium">GEL</span>
          </p>
          <span
            key={status}
            className={cn('hero-badge hero-rise', `hero-badge-${status.toLowerCase()}`)}
          >
            {status}
          </span>
        </div>

        <p className="mono mt-1.5 truncate text-xs text-(--hero-ink-faint)">
          {SATS} sat to {ADDRESS}
        </p>
      </div>

      {/* Every row is laid out from the start and revealed in turn, so a new
          line never pushes the one under it */}
      <ul className="space-y-2 px-4 pb-4 pt-3.5">
        <LogLine
          show={reached('mempool')}
          tone="wait"
          label="Seen in the mempool"
          value={`0 of ${MIN_CONFIRMATIONS}`}
        />

        <LogLine
          show={reached('confirmed')}
          tone="ok"
          label={
            <>
              Mined into block <span className="mono">{BLOCK}</span>
            </>
          }
          value={`${MIN_CONFIRMATIONS} of ${MIN_CONFIRMATIONS}`}
        />

        <LogLine
          show={reached('ledger')}
          tone="ok"
          label={
            <>
              Ledger <span className="mono">+{SATS}</span> merchant,{' '}
              <span className="mono">-{SATS}</span> clearing
            </>
          }
          value="sums to 0"
        />

        <LogLine
          show={reached('webhook')}
          tone="ok"
          label={
            <>
              Signed <span className="mono">payment.settled</span> delivered
            </>
          }
          value="200"
        />
      </ul>
    </div>
  );
}

// A step that has not happened yet is rendered and hidden rather than left out
// visibility keeps the box, so the four rows always occupy the same height and
// nothing below a new line moves when it arrives
function LogLine({
  show,
  tone,
  label,
  value,
}: {
  show: boolean;
  tone: 'wait' | 'ok';
  label: React.ReactNode;
  value: string;
}) {
  return (
    <li
      className={cn(
        // An explicit line height, because half these rows mix the monospace
        // face into the body one and the taller of the two would otherwise set
        // the row height and shift the dot against its own text
        'flex items-center gap-2.5 text-xs leading-5 text-(--hero-ink-muted)',
        show ? 'hero-rise' : 'invisible',
      )}
    >
      <span
        className={cn(
          'size-1.5 shrink-0 rounded-full',
          tone === 'ok' ? 'bg-(--hero-ok)' : 'bg-(--hero-wait)',
        )}
        aria-hidden
      />
      <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
        <span className="truncate">{label}</span>
        <span className="mono shrink-0">{value}</span>
      </span>
    </li>
  );
}
