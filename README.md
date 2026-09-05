# Oathgate

A crypto payment gateway. A shop charges in normal money, the customer pays in
Bitcoin, and Oathgate sits in the middle. It works out the price, gives the
customer an address to pay, watches the blockchain, and records what the shop is
owed.

Backend-focused. Three NestJS **microservices** talking over a queue and an
event channel, Postgres, Redis, an append-only double-entry ledger, and a
Next.js merchant dashboard. It runs on a Raspberry Pi behind Cloudflare and
redeploys itself when I push.

**Live dashboard:** live link here
**Live API:** https://oathgate.tchanu.com/api

> Bitcoin **signet** only, which is a test network. No real money moves through
> this, and the live wallet is not configured on the deployed instance.

---

## What it does, from start to finish

For example, a coffee shop wants 10.50 GEL for a coffee. The customer wants to
pay in Bitcoin. On their own, those two things do not fit together.

1. The shop's server calls `POST /v1/payments`: amount `1050`, currency `GEL`,
   reference `order-4417`
2. Oathgate checks the live Bitcoin rate, holds that price for fifteen minutes,
   and creates a fresh address for this one order
3. The customer pays. A background service watches the blockchain
4. Once the payment is confirmed, two ledger rows are written in one
   transaction, the shop's balance goes up, and a signed webhook is sent to the
   shop's server
5. The shop marks `order-4417` as paid and makes the coffee

The shop never touches a wallet. Oathgate never knows what a coffee is.

---

## Try it

### 1. The dashboard

**live link here**

Open it and sign in. Nothing to install.

Worth clicking, in this order:

| Where | What it shows |
| --- | --- |
| Payments, then any row | One payment from start to finish: what arrived on the blockchain, the ledger rows it wrote, and the webhooks it sent |
| Balance | A balance next to the ledger entries it is calculated from |
| Developers, then Webhooks | Every delivery attempt, when the next retry is due, and the signature that was sent |

### 2. The API

You can check that the API is up and that authentication works:

```bash
curl https://oathgate.tchanu.com/api
# Hello World!

curl https://oathgate.tchanu.com/api/v1/ping
# {"message":"missing api key","error":"Unauthorized","statusCode":401}
```

Creating payments needs a TEST key. I hand those out rather than publish one, so
open an issue if you want one. Running it locally also prints you a key.

Every route, with real requests and responses: [api.md](public-notes/api.md).

### 3. Run it yourself

Needs Docker and Node 22 or newer.

```bash
docker compose up -d          # Postgres and Redis

cd backend
npm install
npx prisma generate
npx prisma migrate deploy
npm run notifications:generate
npm run notifications:migrate
npm run seed                  # prints a TEST api key, once
```

Then three terminals:

```bash
npm run dev              # api, port 5002
npm run dev:worker       # watches the chain, settles, sends webhooks
npm run dev:notifications
```

The dashboard runs on sample data when no API URL is set, so it works on a fresh
clone with no backend at all:

```bash
cd frontend
npm install
npm run dev              # http://localhost:3000
```

Environment variables and the full walkthrough:
[running-locally.md](public-notes/running-locally.md).

---

## Inside

```
   merchant server                              merchant browser
         |  POST /v1/payments                          |
         v                                             v
   +-----------+       BullMQ        +----------+   dashboard (Next.js)
   |    api    | ------------------> |  worker  |
   +-----------+                     +----------+
         |                                |
         |  Postgres                      |  watches the chain
         |  payments, ledger, outbox      |  settles, sends webhooks
         |                                |
         +---------------+----------------+
                         |
                    outbox row
                         |  Redis pub/sub
                         v
                 +---------------+
                 | notifications |  its own database
                 +---------------+
```

| Service | Starts work when | Owns |
| --- | --- | --- |
| `api` | an HTTP request arrives | payments, quotes, keys, sessions |
| `worker` | a timer fires or a job is queued | watching the chain, settling, sending webhooks |
| `notifications` | an event is published | its own database, emails |

They are split by **what starts the work**, not by what the code is about. An
HTTP request has to be answered in milliseconds and watching a blockchain takes
seconds, so those two jobs cannot share a process.

There are two databases. The api and the worker share the payments one, because
they work on the same rows. Notifications has its own and only reacts to events,
so it cannot read a payment even by mistake.

---

## The parts I am most proud of

**A ledger that cannot lose money.** Every movement writes two rows that add up
to zero. Rows are never updated and never deleted. The balance column is a cache
that must always be reproducible by adding up the entries. Undoing a payment
writes a matching pair of reversal rows instead of deleting anything.
[money-and-ledger.md](public-notes/money-and-ledger.md)

**A database lock that is actually tested.** Fifty settlements hit one payment
at the same moment, and the test checks that exactly one pair of ledger rows was
written. Remove the `SELECT ... FOR UPDATE` and it fails with ten winners: no
errors, no warnings, and a shop paid five times for one coffee. The first
version of that test passed with the lock and without it, which is the more
useful story. [testing.md](public-notes/testing.md)

**No floats anywhere near money.** Amounts are whole numbers only. 10.50 GEL is
stored as `1050`, and Bitcoin is stored in satoshis. A computer cannot hold 0.1
exactly, so `0.1 + 0.2` does not equal `0.3`. On a screen that is a harmless
rounding error. In a ledger it is money that has gone missing.
[money-and-ledger.md](public-notes/money-and-ledger.md)

**A transactional outbox.** The message that says "this payment is paid" is
saved in the same database transaction as the money itself, then sent out
afterwards. Otherwise a crash in between leaves the shop paid and never told.
[architecture.md](public-notes/architecture.md)

**The blockchain can change its mind.** Transactions get replaced, blocks get
dropped, and a payment that was confirmed can stop being confirmed. So Oathgate
reads the blockchain as the full current picture every time, instead of adding
whatever is new to a list it already has. When confirmed money disappears, a
background check writes the rows that undo it.
[payment-lifecycle.md](public-notes/payment-lifecycle.md)

---

## Documentation

| | |
| --- | --- |
| [architecture.md](public-notes/architecture.md) | The three services, the two databases, the outbox, and why it is split this way |
| [money-and-ledger.md](public-notes/money-and-ledger.md) | Whole numbers, double entry, the lock, reversals |
| [payment-lifecycle.md](public-notes/payment-lifecycle.md) | The states, confirmations, replaced transactions, reorgs, paying too little or too much |
| [api.md](public-notes/api.md) | Every route, with real requests and responses |
| [webhooks.md](public-notes/webhooks.md) | Signing, retries, duplicate delivery, replay |
| [security.md](public-notes/security.md) | Key storage, sessions, keeping merchants apart, the guards |
| [deployment.md](public-notes/deployment.md) | One image, three containers, CI, and how it reaches the Pi |
| [testing.md](public-notes/testing.md) | What the tests cover and what they caught |
| [running-locally.md](public-notes/running-locally.md) | Environment variables and the full walkthrough |
| [frontend.md](public-notes/frontend.md) | The dashboard, and why it runs on sample data by default |

---

## Stack

NestJS 11, Prisma 7 with driver adapters, PostgreSQL 17, Redis 7, BullMQ,
Next.js 15, TanStack Query, Tailwind. Docker, GitHub Actions on native arm64
runners, Watchtower, Cloudflare Tunnel.

## Scope

Signet only. The live wallet key is not set, so asking for a live payment stops
before anything is written to the database.

Bitcoin first. The ledger and the payment states do not care which blockchain it
is, but only one is connected.

Oathgate is built to the standard I would want in production, and it has not
carried production traffic.
