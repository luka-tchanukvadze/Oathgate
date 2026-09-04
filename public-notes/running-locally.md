# Running it locally

[Back to the README](../README.md)

You need Docker and Node 22 or newer. Node 24 if you want to run the tests.

## 1. Postgres and Redis

```bash
docker compose up -d
```

Both are bound to `127.0.0.1` only, so nothing on your network can reach them.
Postgres is on port 5433 and Redis on 6380, which keeps them clear of anything
already using the usual ports.

## 2. Environment

Create `backend/.env`. Every value below is a placeholder, so replace them.

```ini
# Postgres, matching docker-compose.yml
POSTGRES_USER=oathgate
POSTGRES_PASSWORD=REPLACE_WITH_HEX
POSTGRES_DB=oathgate

DATABASE_URL=postgresql://oathgate:REPLACE_WITH_HEX@localhost:5433/oathgate?schema=public
NOTIFICATIONS_DATABASE_URL=postgresql://oathgate:REPLACE_WITH_HEX@localhost:5433/oathgate_notifications?schema=public

REDIS_URL=redis://localhost:6380

# 32 random bytes as hex, used to encrypt webhook signing secrets at rest
WEBHOOK_SECRET_KEY=REPLACE_WITH_64_HEX_CHARACTERS

# A signet or testnet extended public key, starting tpub or vpub
# A public key can derive addresses and cannot spend from them
BTC_XPUB_TEST=REPLACE_WITH_YOUR_TPUB

# Leave BTC_XPUB_LIVE unset unless you mean it
# With it unset, a live payment stops at address derivation

BLOCKSTREAM_API_URL=https://blockstream.info/signet/api

DASHBOARD_ORIGIN=http://localhost:3000

# Read only by the seed
SEED_MERCHANT_EMAIL=you@example.com
SEED_MERCHANT_PASSWORD=REPLACE_WITH_A_LONG_PASSWORD

# Optional
COINGECKO_API_KEY=
SMTP_HOST=
SMTP_PORT=
SMTP_USER=
SMTP_PASSWORD=
MAIL_FROM=
```

### Make the database password hex

This one costs an hour if you get it wrong.

`openssl rand -base64 24` produces characters including `/`. The password goes
inside `DATABASE_URL`, and a `/` reads as the end of the credentials, so the URL
parser then looks for a port in the wrong place. Prisma reports `P1013 invalid
port number`, which points nowhere near the real cause.

Use hex:

```bash
openssl rand -hex 24
```

Postgres only reads `POSTGRES_PASSWORD` when its data directory is empty. If you
change it after the first start, you need `docker compose down -v` for it to
take effect, and that deletes the data.

### Getting a signet extended public key

Any wallet that supports signet or testnet will export one. Sparrow and
Electrum both do. Export the **public** key, at the path `m/84'/1'/0'`, which is
native segwit on a test network. It starts with `tpub` or `vpub`.

An extended public key can generate addresses and cannot spend from them, so it
is safe to put in a `.env` on a development machine. Never put an extended
**private** key anywhere.

## 3. Set up the databases

```bash
cd backend
npm install

npx prisma generate
npx prisma migrate deploy

npm run notifications:generate
npm run notifications:migrate
```

Two of everything, because notifications owns a separate database with its own
schema.

If the notifications database does not exist yet:

```bash
docker exec -it oathgate-postgres psql -U oathgate -d oathgate \
  -c "CREATE DATABASE oathgate_notifications;"
```

## 4. Seed

```bash
npm run seed
```

This creates the merchant, the six accounts it needs, and one TEST API key.
The key is printed **once** and never again, so copy it now.

```
merchant  you@example.com (0198f0b1-...)
accounts  6 created, 0 already there
test key  sk_test_a1b2c3d4e5f6...
```

The seed is safe to run twice. It upserts the merchant, uses `ON CONFLICT DO
NOTHING` for the accounts, and will not create a second key if an active one
exists.

Without the seed there are no house accounts, and nothing can settle at all,
because every ledger movement needs a house account on the other side of it.

## 5. Run the services

Three terminals, in `backend/`:

```bash
npm run dev              # api on 5002
npm run dev:worker       # chain watcher, queue, webhook sender
npm run dev:notifications
```

And the dashboard, in `frontend/`:

```bash
npm install
npm run dev              # http://localhost:3000
```

To point the dashboard at your local API, create `frontend/.env.local`:

```ini
NEXT_PUBLIC_API_URL=http://localhost:5002
```

Leave it out and the dashboard uses its built-in sample data instead. See
[frontend.md](frontend.md).

## 6. Make a payment

```bash
curl -X POST http://localhost:5002/api/v1/payments \
  -H "Authorization: Bearer sk_test_YOUR_KEY" \
  -H "Idempotency-Key: $(uuidgen)" \
  -H "Content-Type: application/json" \
  -d '{"fiatAmount":"1050","fiatCurrency":"GEL","cryptoCurrency":"BTC","reference":"order-4417"}'
```

You get back a signet address. Either send it coins from a signet faucet and
watch the worker pick them up, or skip the wait:

```bash
curl -X POST http://localhost:5002/api/v1/payments/PAYMENT_ID/confirm \
  -H "Authorization: Bearer sk_test_YOUR_KEY"
```

That route is test mode only. It settles the payment, writes the ledger rows,
and fires the webhook, so you can see the whole path in a few seconds.

## Tests

```bash
npm run test:e2e
```

Needs Postgres and Redis up, and Node 24. See [testing.md](testing.md) for why
the version matters and what the tests actually prove.

## If something is wrong

**`P1013 invalid port number`**
A special character in the database password, see above.

**`column ... does not exist`**
A migration has not been run, and both databases need their own.

**`Cannot find module '../libs/shared/src/generated/prisma/client'`**
Run `npx prisma generate`.

**The worker logs nothing**
That is expected when nothing is waiting. It prints a line every thirty seconds
saying how many addresses it polled, so if you see nothing at all it is not
running.
