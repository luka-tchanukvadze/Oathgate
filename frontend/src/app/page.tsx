import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Logo } from '@/components/layout/logo';

// One job: get a recruiter into the demo in one click, and give an engineer
// something to paste into a terminal without signing up. Nothing here that does
// not serve one of those two

const CURL = `curl -X POST https://api.oathgate.dev/v1/payments \\
  -H "Authorization: Bearer sk_test_public_demo_key" \\
  -H "Idempotency-Key: demo-123" \\
  -H "Content-Type: application/json" \\
  -d '{"amount": 1050, "currency": "GEL", "settle_in": "BTC"}'`;

const RESPONSE = `{
  "id": "pay_9f2a71c4be08",
  "status": "pending",
  "amount": 1050,
  "currency": "GEL",
  "crypto_amount": "3692",
  "crypto_currency": "BTC",
  "address": "tb1q8xk2m...",
  "expires_at": "2026-08-08T14:22:10Z"
}`;

const STEPS = [
  {
    n: '01',
    title: 'Merchant requests 10.50 GEL',
    body: 'One POST with an idempotency key. A retry returns the first response instead of charging twice.',
  },
  {
    n: '02',
    title: 'Oathgate quotes and locks',
    body: 'Converts at the live rate, locks it for fifteen minutes, and derives an address used by this payment alone.',
  },
  {
    n: '03',
    title: 'Oathgate watches for the payment',
    body: 'Every transaction to that address is recorded, so the exact amount received is known, including a customer who sends too little or too much.',
  },
  {
    n: '04',
    title: 'The merchant is credited',
    body: 'At three confirmations the balance moves and a signed webhook goes out, so the shop can mark the order paid without asking.',
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
      <header className="border-b border-line">
        <div className="mx-auto flex h-14 max-w-5xl items-center px-5">
          <Logo />
          <nav className="ml-auto flex items-center">
            <Link
              href="/dashboard"
              className="inline-flex h-9 items-center gap-1.5 rounded-full bg-accent px-4 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover"
            >
              Open the demo
              <ArrowRight className="size-3.5" aria-hidden />
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="mx-auto max-w-5xl px-5 py-20 sm:py-28">
          <div className="grid items-start gap-14 lg:grid-cols-[1fr_minmax(0,420px)]">
            <div className="max-w-xl">
              <h1 className="text-[2.5rem] font-semibold leading-[1.1] tracking-tight text-ink sm:text-5xl">
                Accept Bitcoin, price every order in your own currency
              </h1>

              <p className="mt-5 text-base leading-relaxed text-ink-muted">
                A shop asks for 10.50 GEL. Oathgate locks the Bitcoin amount, watches for the payment,
                credits the merchant after three confirmations, and sends a signed webhook.
              </p>

              <div className="mt-8">
                <Link
                  href="/dashboard"
                  className="inline-flex h-11 items-center gap-2 rounded-full bg-accent px-5 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover"
                >
                  Open the demo
                  <ArrowRight className="size-4" aria-hidden />
                </Link>
              </div>

              <p className="mt-4 text-xs text-ink-faint">
                No signup. Test mode only, Bitcoin testnet, no real funds.
              </p>
            </div>

            <div className="min-w-0 space-y-2">
              <div className="shadow-card overflow-hidden rounded-tile">
                <div className="border-b border-line px-4 py-2 text-xs text-ink-subtle">Create a payment</div>
                <pre className="scrollbar-thin overflow-x-auto px-4 py-3.5 text-xs leading-relaxed">
                  <code className="mono text-ink">{CURL}</code>
                </pre>
              </div>
              <div className="shadow-card overflow-hidden rounded-tile bg-surface-muted">
                <div className="border-b border-line px-4 py-2 text-xs text-ink-subtle">Response</div>
                <pre className="scrollbar-thin overflow-x-auto px-4 py-3.5 text-xs leading-relaxed">
                  <code className="mono text-ink">{RESPONSE}</code>
                </pre>
              </div>
              <p className="pt-1 text-xs text-ink-faint">
                <span className="mono">1050</span> is 10.50 GEL in minor units. No amount in this system is
                ever a floating point number.
              </p>
            </div>
          </div>
        </section>

        <section className="border-y border-line bg-canvas">
          <div className="mx-auto max-w-5xl px-5 py-16">
            <h2 className="text-xl font-semibold tracking-tight text-ink">How a payment works</h2>
            <div className="mt-8 grid gap-x-8 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
              {STEPS.map(({ n, title, body }) => (
                <div key={n}>
                  <span className="mono text-xs text-ink-faint">{n}</span>
                  <h3 className="mt-2 text-sm font-semibold text-ink">{title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-subtle">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-5xl px-5 py-16">
          <h2 className="text-xl font-semibold tracking-tight text-ink">The parts that are hard to get right</h2>
          <p className="mt-2 max-w-2xl text-sm text-ink-muted">
            A payment gateway is not a CRUD app with a status column. These are the pieces that decide
            whether it can be trusted with money.
          </p>

          <dl className="mt-9 grid gap-x-10 gap-y-8 sm:grid-cols-2">
            {DEPTH.map(({ title, body }) => (
              <div key={title}>
                <dt className="text-sm font-semibold text-ink">{title}</dt>
                <dd className="mt-1.5 text-sm leading-relaxed text-ink-subtle">{body}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="border-t border-line bg-canvas">
          <div className="mx-auto max-w-5xl px-5 py-16 text-center">
            <h2 className="text-xl font-semibold tracking-tight text-ink">See it settle, end to end</h2>
            <p className="mx-auto mt-2.5 max-w-xl text-sm leading-relaxed text-ink-muted">
              Create a payment, simulate the customer paying it, and watch the status move through
              confirming to paid while the ledger entries appear and the webhook fires. Then reverse it and
              watch the compensating pair get written.
            </p>
            <Link
              href="/dashboard"
              className="mt-7 inline-flex h-11 items-center gap-2 rounded-full bg-accent px-5 text-sm font-medium text-on-accent transition-colors hover:bg-accent-hover"
            >
              Open the demo
              <ArrowRight className="size-4" aria-hidden />
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-6 text-xs text-ink-faint">
          <span>Oathgate, a portfolio project by Luka Tchanukvadze</span>
          <span>Bitcoin testnet only. No real funds move through this.</span>
        </div>
      </footer>
    </div>
  );
}
