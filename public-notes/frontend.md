# The dashboard

[Back to the README](../README.md)

Next.js, TanStack Query, Tailwind. It is the merchant's view: their payments,
their balance, their API keys, and their webhook log.

## It runs on sample data by default

There is one line that decides this:

```ts
export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';
export const USING_MOCK = API_BASE.trim().length === 0;
```

With no API URL set, every screen reads from a sample dataset built into the
app. Set the URL and the same screens read from the real API.

Three reasons it is built this way.

**Anyone can look at it.** Clone the repo, `npm install`, `npm run dev`, and the
whole dashboard works. No Docker, no database, no keys, no setup.

**The screens were designed before the API existed.** Building against sample
data first meant the shape of the data was decided by what the screens actually
needed, instead of the screens being bent around whatever the API happened to
return.

**The seam is in one place.** Everything lives in `src/lib/api/`, and no
component imports the sample data directly. Connecting the real backend does not
touch a single screen.

## What is worth looking at

**The payment detail page.** The most useful screen in the app. One payment,
with the transactions seen on the blockchain, the ledger rows it wrote, and
every webhook it sent, on one page in the order they happened.

That page is served by a single endpoint on purpose. Four separate requests
would each read the database at their own moment, and a settlement landing
between two of them would show a pending payment sitting next to the ledger rows
that already paid the shop.

**The balance page.** A balance next to the entries it is calculated from. The
point being made is that the number is a cache and the entries are the truth.

**The webhook log.** Every attempt as its own row, with its response code and
how long it took, plus the exact body that was signed. A counter would say a
delivery failed four times. These rows say what happened each time.

## Design decisions

**One light theme, no theme switcher.** A switcher doubles every colour
decision, and this is one product with one look.

**A sidebar, not top navigation.** Sections get added to a product like this
over time, and a sidebar takes a new item without a redesign.

**Mechanisms get a log line, not a navigation item.** The outbox, the queue,
idempotency replays and notification sends are all interesting and none of them
deserve their own page. They show up as entries in one developer log.

**Live mode is present and locked, not hidden.** The test and live toggle is
real and visible. Live is switched off because there is no live wallet
configured, and the interface says so rather than pretending the mode does not
exist.

**No secret API key in browser JavaScript, ever.** The dashboard authenticates
with an httpOnly cookie. Anything in browser JavaScript is readable by anyone,
and a leaked secret key would let a stranger create payments as that merchant.
This is why the API has two separate route trees, one for keys and one for
cookies. See [security.md](security.md).

## State

TanStack Query, not Redux.

Almost everything on screen is server state: rows that live in a database,
fetched over HTTP, that go stale and need refetching. Redux is built for client
state, and using it here means writing caching, retries, deduplication and
background refresh by hand.

The little client state that exists, which tab you are on and whether a dialog
is open, is `useState`.

## Status

The screens are built and the real-API branch of every function is written.
Connecting them to the live backend is in progress.
