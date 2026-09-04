import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Panel, PanelBody, PanelHeader, PanelTitle } from '@/components/ui/panel';

// The whole story, once, instead of a paragraph on top of every table. A screen
// should show data. This is where the explaining lives

const PARTIES = [
  {
    who: 'Oathgate',
    what: 'The gateway. Quotes the price in Bitcoin, hands out an address, watches the chain, keeps the ledger, tells the shop when money lands.',
  },
  {
    who: 'The merchant',
    what: 'A shop that wants to accept Bitcoin. They sign up, take an API key, and call the API from their checkout. This dashboard is theirs.',
  },
  {
    who: 'The customer',
    what: 'The person buying something. They never sign up and have no account here. They scan a QR code and send coins, and that is the whole of their involvement.',
  },
];

const FLOW = [
  {
    n: '01',
    title: 'The shop asks for money',
    body: 'Their checkout calls POST /v1/payments with an amount, a currency and their API key. "Charge this customer 10.50 GEL."',
  },
  {
    n: '02',
    title: 'Oathgate quotes and locks',
    body: 'We convert 10.50 GEL to Bitcoin at the current rate, freeze that rate for fifteen minutes, and derive an address that belongs to this one payment and nothing else.',
  },
  {
    n: '03',
    title: 'The customer pays',
    body: 'They scan the QR and send coins. Nothing has settled yet, because a transaction that has just been broadcast can still be undone.',
  },
  {
    n: '04',
    title: 'We wait for confirmations',
    body: 'Each new block on top of the payment makes it harder to reverse. At three blocks we treat it as final. This is the part card payments have no equivalent of.',
  },
  {
    n: '05',
    title: 'We write the ledger and tell the shop',
    body: 'Two rows are written that cancel out, the merchant balance goes up, and a signed webhook fires so the shop can mark the order paid.',
  },
];

const SCREENS = [
  { href: '/dashboard', name: 'Home', what: 'How the last two weeks went, and anything that needs looking at.' },
  { href: '/dashboard/payments', name: 'Payments', what: 'One row per attempt to charge a customer. Click any of them for the full story.' },
  { href: '/dashboard/balance', name: 'Balance', what: 'Your recorded Bitcoin balance and every ledger entry behind it.' },
  { href: '/dashboard/developers/keys', name: 'API keys', what: 'The password your server uses to prove it is you.' },
  { href: '/dashboard/developers/webhooks', name: 'Webhooks', what: 'Oathgate calling your server when something happens, so you do not have to keep asking.' },
  { href: '/dashboard/developers/events', name: 'Events', what: 'A log of everything the services did behind your payments. Where you look when something behaved oddly.' },
  { href: '/dashboard/insights', name: 'Insights', what: 'A language model reading your numbers and saying what it notices. Read only, always.' },
];

export default function GuidePage() {
  return (
    <>
      <PageHeader title="Guide" description="What this is, who it is for, and how a payment actually works." />

      <div className="grid gap-4 xl:grid-cols-3">
        <Panel className="xl:col-span-2">
          <PanelHeader>
            <PanelTitle>Who is involved</PanelTitle>
          </PanelHeader>
          <PanelBody>
            <dl className="space-y-4">
              {PARTIES.map(({ who, what }) => (
                <div key={who}>
                  <dt className="text-sm font-semibold text-ink">{who}</dt>
                  <dd className="mt-1 text-sm leading-relaxed text-ink-muted">{what}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-5 border-t border-line pt-4 text-sm leading-relaxed text-ink-muted">
              Only the merchant holds an account. Customers are never asked to register, install anything or
              trust Oathgate with a login, which is most of the reason crypto checkout converts at all.
            </p>
          </PanelBody>
        </Panel>

        <Panel className="xl:col-span-1">
          <PanelHeader>
            <PanelTitle>What Oathgate does not do</PanelTitle>
          </PanelHeader>
          <PanelBody>
            <ul className="space-y-2.5 text-sm leading-relaxed text-ink-muted">
              <li>Hold customer funds. There is no custody here.</li>
              <li>Exchange Bitcoin into lari and wire it to a bank.</li>
              <li>Identity checks, sanctions screening, licensing.</li>
              <li>Card terminals or a consumer wallet app.</li>
            </ul>
            <p className="mt-4 border-t border-line pt-4 text-sm leading-relaxed text-ink-muted">
              Oathgate is the settlement engine. Custody, treasury and compliance are separate concerns, and
              keeping them out of this codebase is deliberate rather than incidental.
            </p>
          </PanelBody>
        </Panel>
      </div>

      <Panel className="mt-4">
        <PanelHeader>
          <PanelTitle>How one payment works, start to finish</PanelTitle>
        </PanelHeader>
        <PanelBody>
          <ol className="grid gap-6 sm:grid-cols-2 xl:grid-cols-5">
            {FLOW.map(({ n, title, body }) => (
              <li key={n}>
                <span className="mono text-xs text-ink-faint">{n}</span>
                <h3 className="mt-1.5 text-sm font-semibold text-ink">{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-muted">{body}</p>
              </li>
            ))}
          </ol>
        </PanelBody>
      </Panel>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <Panel>
          <PanelHeader>
            <PanelTitle>Environments</PanelTitle>
          </PanelHeader>
          <PanelBody className="space-y-3 text-sm leading-relaxed text-ink-muted">
            <p>
              This workspace settles on <span className="font-medium text-ink">Bitcoin testnet</span>. That
              is a real Bitcoin network with real blocks, real confirmations and real addresses. The only
              difference from mainnet is that the coins are free, from a faucet, and worth nothing.
            </p>
            <p>
              So sending actual coins to a payment here works, and is the most honest way to try this. You
              do not switch anything to do it, and you do not need to own Bitcoin.
            </p>
            <p>
              Mainnet settles in Bitcoin that is worth money, which means Oathgate holds customer funds.
              Activation requires custody arrangements and regulatory approval, and is not enabled for this
              workspace.
            </p>
            <p>
              Your integration does not change between the two. Keys carry the environment, every record
              carries the environment, and no query crosses between them. Activating swaps one key for
              another and nothing else in your code moves.
            </p>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader>
            <PanelTitle>Getting started</PanelTitle>
          </PanelHeader>
          <PanelBody>
            <ol className="space-y-3 text-sm leading-relaxed text-ink-muted">
              <li>
                <span className="font-medium text-ink">1.</span> Sign up and get a test key from the API
                keys page.
              </li>
              <li>
                <span className="font-medium text-ink">2.</span> Call{' '}
                <span className="mono text-xs">POST /v1/payments</span> from their checkout and get back an
                address and an amount.
              </li>
              <li>
                <span className="font-medium text-ink">3.</span> Show the customer the address, or send them
                to the hosted checkout page.
              </li>
              <li>
                <span className="font-medium text-ink">4.</span> Send testnet coins from a faucet and watch
                the payment confirm.
              </li>
              <li>
                <span className="font-medium text-ink">5.</span> Point a webhook at their server so the shop
                marks the order paid on its own.
              </li>
              <li>
                <span className="font-medium text-ink">6.</span> Activate the account and swap the test key
                for a live one. Nothing else in the integration changes.
              </li>
            </ol>
          </PanelBody>
        </Panel>
      </div>

      <Panel className="mt-4">
        <PanelHeader>
          <PanelTitle>About this workspace</PanelTitle>
        </PanelHeader>
        <PanelBody className="space-y-3 text-sm leading-relaxed text-ink-muted">
          <p>
            You are signed in to <span className="font-medium text-ink">Demo Coffee Co</span>, a shared
            workspace open to anyone, with no account required. It is seeded with two weeks of payments so
            every screen has something in it.
          </p>
          <p>
            One thing here stands in for something outside the system: the{' '}
            <span className="font-medium text-ink">Simulate customer payment</span> button on a pending
            payment. In normal use a person sends coins from their own wallet, and that button does the
            same on their behalf so you can watch a payment settle in about ten seconds. Sending real
            testnet coins to the address instead takes a few minutes and produces an identical result,
            because Oathgate cannot tell the two apart.
          </p>
          <p>
            Everything the button triggers afterwards is the real path: the same confirmations, the same
            ledger entries, the same webhook.
          </p>
        </PanelBody>
      </Panel>

      <Panel className="mt-4">
        <PanelHeader>
          <PanelTitle>What each screen is for</PanelTitle>
        </PanelHeader>
        <ul className="divide-y divide-line">
          {SCREENS.map(({ href, name, what }) => (
            <li key={href}>
              <Link href={href} className="flex items-center gap-4 px-5 py-3.5 hover:bg-surface-muted sm:px-6">
                <span className="w-28 shrink-0 text-sm font-medium text-ink">{name}</span>
                <span className="min-w-0 flex-1 text-sm text-ink-muted">{what}</span>
                <ArrowRight className="size-3.5 shrink-0 text-ink-faint" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </Panel>
    </>
  );
}
