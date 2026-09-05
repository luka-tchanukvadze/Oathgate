import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Logo } from '@/components/layout/logo';
import { LiveSettlement } from '@/components/marketing/live-settlement';
import {
  MAX_WEBHOOK_ATTEMPTS,
  MIN_CONFIRMATIONS,
  QUOTE_TTL_MINUTES,
} from '@/lib/constants';

// One job: get a recruiter into the demo in one click, and give an engineer
// something to paste into a terminal without signing up. Nothing here that does
// not serve one of those two

const FACTS = [
  {
    value: 'NUMERIC(38,0)',
    label: 'Every amount, fiat and crypto',
    body: 'Integers all the way down. No float touches money at any layer, including this page.',
  },
  {
    value: '2 rows',
    label: 'Per movement of money',
    body: 'Double entry, append only. A balance is a sum of entries I can rebuild at any time.',
  },
  {
    value: `${QUOTE_TTL_MINUTES} minutes`,
    label: 'A quote stays good for',
    body: 'The rate is locked when the payment is created, so the price cannot move under the customer.',
  },
  {
    value: `${MAX_WEBHOOK_ATTEMPTS} attempts`,
    label: 'Before a webhook dead letters',
    body: 'Exponential backoff from ten seconds to six hours, then it stops and waits for a replay.',
  },
];

const STEPS = [
  {
    n: '01',
    title: 'A shop asks for 10.50 GEL',
    body: 'One POST with an idempotency key. A retry returns the first response instead of charging twice.',
  },
  {
    n: '02',
    title: 'Oathgate quotes and locks',
    body: `Converts at the live rate, holds it for ${QUOTE_TTL_MINUTES} minutes, and derives an address used by this payment alone.`,
  },
  {
    n: '03',
    title: 'The chain is watched',
    body: 'Every transaction to that address is recorded, so the exact amount received is known, including a customer who sends too little or too much.',
  },
  {
    n: '04',
    title: 'The merchant is credited',
    body: 'At the confirmation threshold the balance moves and a signed webhook goes out, so the shop can mark the order paid without asking.',
  },
];

const DEPTH = [
  {
    title: 'Double entry, append only',
    body: 'Every movement is two rows that sum to zero, and the balance is a projection I can rebuild from them at any time. Undoing a reorg writes a compensating pair rather than deleting history.',
  },
  {
    title: 'Correct under concurrency',
    body: 'Settlement takes a row lock on the balance inside the transaction. A test fires fifty simultaneous confirmations at one payment and asserts exactly one ledger pair exists.',
  },
  {
    title: 'No float touches money',
    body: 'Fiat is integer minor units, crypto is integer base units, both NUMERIC(38,0) in Postgres. Even this dashboard formats amounts by shifting digits rather than dividing.',
  },
  {
    title: 'Events survive a crash',
    body: 'The event row is written in the same transaction as the ledger, then relayed separately. A process dying between commit and publish cannot lose a merchant notification.',
  },
];

export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-surface">
      <section className="hero">
        <header className="relative z-10">
          <div className="mx-auto flex h-20 max-w-6xl items-center px-5 sm:px-8">
            <Logo onDark />
            <nav className="ml-auto flex items-center gap-2">
              <Link
                href="/dashboard"
                className="inline-flex h-10 items-center gap-1.5 rounded-full bg-(--hero-ink) px-5 text-sm font-semibold text-(--hero-bg) transition-transform hover:scale-[1.03]"
              >
                Open the demo
                <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            </nav>
          </div>
        </header>

        <div className="relative z-10 mx-auto max-w-6xl px-5 pb-24 pt-10 sm:px-8 sm:pb-32 sm:pt-16">
          <div className="grid items-center gap-14 lg:grid-cols-[1fr_minmax(0,470px)]">
            <div className="max-w-2xl">
              <h1 className="text-[2.75rem] font-semibold leading-[1.03] tracking-[-0.035em] text-(--hero-ink) sm:text-6xl lg:text-[4.25rem]">
                Accept Bitcoin,
                <br />
                price every order
                <br />
                <span className="hero-shine">in your own currency</span>
              </h1>

              <p className="mt-7 max-w-xl text-base leading-relaxed text-(--hero-ink-muted) sm:text-lg">
                A shop asks for 10.50 GEL. Oathgate locks the Bitcoin amount, watches the chain,
                credits the merchant the moment it confirms, and sends a signed webhook.
              </p>

              <div className="mt-9 flex flex-wrap items-center gap-3">
                <Link
                  href="/dashboard"
                  className="inline-flex h-12 items-center gap-2 rounded-full bg-(--hero-accent) px-6 text-sm font-semibold text-white transition-transform hover:scale-[1.03]"
                >
                  Open the demo
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
                <Link
                  href="/dashboard/guide"
                  className="inline-flex h-12 items-center rounded-full px-6 text-sm font-semibold text-(--hero-ink) ring-1 ring-(--hero-line) transition-colors hover:bg-white/5"
                >
                  Read the integration guide
                </Link>
              </div>

              <p className="mt-5 text-xs text-(--hero-ink-faint)">
                No signup. Testnet coins are free and worth nothing, and the blocks confirming them
                are real.
              </p>
            </div>

            <div>
              <LiveSettlement />
              <p className="sr-only">
                A looping illustration of one payment. A request creates it, the transaction is
                seen in the mempool, a block confirms it, two ledger entries are written that sum
                to zero, and a signed webhook is delivered.
              </p>
            </div>
          </div>
        </div>
      </section>

      <main>
        <section className="border-b border-line bg-canvas">
          <div className="mx-auto grid max-w-6xl gap-x-8 gap-y-9 px-5 py-16 sm:grid-cols-2 sm:px-8 lg:grid-cols-4">
            {FACTS.map(({ value, label, body }) => (
              <div key={label}>
                <p className="mono text-lg font-semibold tracking-tight text-ink">{value}</p>
                <p className="mt-1 text-xs font-semibold uppercase tracking-[0.08em] text-ink-faint">
                  {label}
                </p>
                <p className="mt-2.5 text-sm leading-relaxed text-ink-subtle">{body}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
          <h2 className="text-2xl font-semibold tracking-tight text-ink">How a payment works</h2>
          <div className="mt-10 grid gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map(({ n, title, body }) => (
              <div key={n} className="relative border-t-2 border-accent-line pt-5">
                <span className="mono text-xs font-semibold text-accent">{n}</span>
                <h3 className="mt-2 text-base font-semibold text-ink">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-subtle">{body}</p>
              </div>
            ))}
          </div>

          <p className="mt-10 max-w-3xl text-sm leading-relaxed text-ink-muted">
            The threshold is {MIN_CONFIRMATIONS} confirmation. A confirmation is not a second
            opinion, it is a price: reversing the payment now means rebuilding that many blocks
            faster than everybody else together, and that is already far more than a coffee is worth
            stealing. Six blocks on a ten minute chain is an hour of a customer standing at a
            counter.
          </p>
        </section>

        <section className="border-y border-line bg-canvas">
          <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
            <h2 className="text-2xl font-semibold tracking-tight text-ink">
              The parts that are hard to get right
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-muted">
              A payment gateway is not a CRUD app with a status column. These are the pieces that
              decide whether it can be trusted with money.
            </p>

            <dl className="mt-11 grid gap-x-10 gap-y-9 sm:grid-cols-2">
              {DEPTH.map(({ title, body }) => (
                <div key={title} className="shadow-card rounded-tile bg-surface px-6 py-6">
                  <dt className="text-base font-semibold text-ink">{title}</dt>
                  <dd className="mt-2 text-sm leading-relaxed text-ink-subtle">{body}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <section className="hero">
          <div className="relative z-10 mx-auto max-w-3xl px-5 py-24 text-center sm:px-8">
            <h2 className="text-3xl font-semibold tracking-tight text-(--hero-ink) sm:text-4xl">
              Watch one settle, end to end
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-(--hero-ink-muted)">
              Create a payment, pay it, and watch the status move while the ledger entries appear
              and the webhook fires. Then reverse it and watch the compensating pair get written.
            </p>
            <Link
              href="/dashboard"
              className="mt-9 inline-flex h-12 items-center gap-2 rounded-full bg-(--hero-accent) px-6 text-sm font-semibold text-white transition-transform hover:scale-[1.03]"
            >
              Open the demo
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-8 text-xs text-ink-faint sm:px-8">
          <span>Oathgate by Luka Tchanukvadze</span>
          <span>Bitcoin testnet only. No real funds move through this.</span>
        </div>
      </footer>
    </div>
  );
}
