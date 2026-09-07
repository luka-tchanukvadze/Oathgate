# Oathgate backend

Three NestJS services and the libraries they share. What each one is and why it
is split this way: [architecture.md](../public-notes/architecture.md).

```
apps/
  api/            HTTP. Payments, quotes, keys, sessions, search
  worker/         Timers and queued jobs. Watches the chain, settles, sends webhooks
  notifications/  Consumes events. Its own database, sends email
libs/
  shared/         Prisma, the ledger, settlement, money, webhook signing
  contracts/      The event shape on the wire, owned by neither side
```

One image runs all three. The Dockerfile's `CMD` starts the api and compose
overrides it for the other two.

## Running it

Postgres and Redis first, from the repository root:

```bash
docker compose up -d
```

Then here:

```bash
npm install
cp .env.example .env          # then fill it in
npx prisma generate
npx prisma migrate deploy
npm run notifications:generate
npm run notifications:migrate
npm run seed                  # prints a TEST api key, once
```

Each service in its own terminal:

```bash
npm run dev                   # api, port 5002
npm run dev:worker
npm run dev:notifications
```

Every variable, and which ones are optional:
[running-locally.md](../public-notes/running-locally.md).

## Tests

```bash
npm test                      # unit
npm run test:e2e              # needs Postgres and Redis up
```

The e2e suites are the ones worth reading. Fifty settlements against one
payment, idempotent retries, webhook backoff, and the SSRF checks on a merchant
supplied url. What each one caught: [testing.md](../public-notes/testing.md).

## Two databases

The api and the worker share the payments database, because they work on the
same rows. Notifications owns a second one and only ever reacts to events, so it
cannot read a payment even by accident. That is why there are two Prisma schemas
and two sets of migration commands above.

## Conventions

Folders are features, not layers. Everything auth-related is in `src/auth/`,
not spread across a top-level `guards/`. Files are named `<thing>.<role>.ts`.

Money is integers only. Fiat in minor units, crypto in base units, and every
amount carries its currency. The reasoning, and what goes wrong without it:
[money-and-ledger.md](../public-notes/money-and-ledger.md).

`src/generated/**` is not mine and is not linted.
