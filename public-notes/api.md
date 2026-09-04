# API reference

[Back to the README](../README.md)

Base URL is `https://oathgate.tchanu.com/api` on the deployed instance, or
`http://localhost:5002/api` locally.

Everything the backend serves lives under `/api`. That one prefix is what makes
a single hostname able to serve both the API and, one day, anything else,
without a rule that has to be remembered in two places.

## Two ways in, and they never share a route

| | Used by | Authenticates with | Routes |
| --- | --- | --- | --- |
| Public API | a merchant's **server** | `Authorization: Bearer sk_test_...` | `/api/v1/*` |
| Dashboard | a merchant's **browser** | an httpOnly session cookie | `/api/dashboard/*` |

They are separate route trees rather than one tree with two guards. A route
that accepts either credential is a route where a mistake in one path is
exploitable through the other. Splitting them means the question "can a browser
reach this" is answered by the URL.

The reason it matters: a secret API key must never be in browser JavaScript,
because anything in browser JavaScript is readable by anyone. So the dashboard
cannot hold one, which is why it has a cookie instead.

## Public API

An API key carries its own mode, so a test key can only ever see test rows.
There is no `mode` parameter on any of these.

### `GET /api/v1/ping`

Confirms a key works.

```bash
curl https://oathgate.tchanu.com/api/v1/ping \
  -H "Authorization: Bearer sk_test_YOUR_KEY"
```

```json
{ "merchantId": "0198...", "mode": "TEST" }
```

### `GET /api/v1/quote`

What an amount is worth right now, without creating anything.

```
?fiatAmount=1050&fiatCurrency=GEL&cryptoCurrency=BTC
```

```json
{
  "fiatAmount": "1050",
  "fiatCurrency": "GEL",
  "cryptoAmount": "3692",
  "cryptoCurrency": "BTC",
  "rate": "0.00000351...",
  "expiresAt": "2026-09-04T12:15:00.000Z"
}
```

### `POST /api/v1/payments`

Creates a payment. **An `Idempotency-Key` header is required.**

```bash
curl -X POST https://oathgate.tchanu.com/api/v1/payments \
  -H "Authorization: Bearer sk_test_YOUR_KEY" \
  -H "Idempotency-Key: 8f3a2c1e-0b44-4c7a-9f21-6d5e0a2b7c11" \
  -H "Content-Type: application/json" \
  -d '{"fiatAmount":"1050","fiatCurrency":"GEL","cryptoCurrency":"BTC","reference":"order-4417"}'
```

`fiatAmount` is minor units as a string. `1050` is 10.50 GEL. A decimal point is
a 400.

```json
{
  "id": "0198f0c2-...",
  "status": "PENDING",
  "mode": "TEST",
  "reference": "order-4417",
  "fiatAmount": "1050",
  "fiatCurrency": "GEL",
  "cryptoAmount": "3692",
  "cryptoCurrency": "BTC",
  "quotedRate": "0.00000351...",
  "address": "tb1q...",
  "expiresAt": "2026-09-04T12:15:00.000Z",
  "createdAt": "2026-09-04T12:00:00.000Z"
}
```

**The idempotency key is required, not optional.** A retried create without one
is a second invoice for the same order. Sending the same key twice with the same
body returns the first response. Sending the same key with a **different** body
is a 422, because that is a bug in the caller rather than a retry.

### `GET /api/v1/payments`

Filters: `limit`, `startingAfter`, `status`, `reference`.

```json
{ "data": [ ... ], "hasMore": false }
```

Paging is by cursor, not by offset, and there is no total. Counting the whole
table on every page is work nobody asked for, and an offset shifts under you
when rows are inserted. `startingAfter` takes the id of the last row you have,
and UUIDv7 sorts by creation time, so the id is the cursor.

### `GET /api/v1/payments/:id`

One payment. Scoped to the calling merchant and the key's mode, so somebody
else's payment id is a 404 rather than a payment.

### `POST /api/v1/payments/:id/confirm`

**Test mode only.** Stands in for the blockchain so an integration can be tested
without waiting for real confirmations. In live mode the chain decides, and this
route returns 403.

## Dashboard API

All of these need the session cookie and take an explicit `mode` parameter,
because a browser has a test/live toggle and a cookie says nothing about which
side of it you are on.

| Route | Does |
| --- | --- |
| `POST /api/dashboard/auth/login` | Sets the session cookie. Rate limited to five a minute |
| `POST /api/dashboard/auth/logout` | Revokes the session row and clears the cookie |
| `GET /api/dashboard/auth/me` | Who the session belongs to |
| `GET /api/dashboard/payments?mode=TEST` | Paged list |
| `GET /api/dashboard/payments/:id?mode=TEST` | The payment, its chain transactions, its ledger rows and its webhooks, in one response |
| `POST /api/dashboard/payments` | Create. Takes `mode` in the body |
| `POST /api/dashboard/payments/:id/confirm?mode=TEST` | Test mode only |
| `GET /api/dashboard/balances?mode=TEST` | Account balances |
| `GET /api/dashboard/ledger?mode=TEST` | Ledger entries, filterable by `paymentId` |
| `GET /api/dashboard/webhook-endpoints?mode=TEST` | Where notifications are sent |
| `POST /api/dashboard/webhook-endpoints` | Register one. Returns the signing secret once |
| `DELETE /api/dashboard/webhook-endpoints/:id` | Disables it. Deliveries still point at it |
| `GET /api/dashboard/webhook-deliveries?mode=TEST` | Delivery log |
| `GET /api/dashboard/webhook-deliveries/:id` | One delivery, with the exact body that was signed and every attempt |
| `POST /api/dashboard/webhook-deliveries/:id/replay` | Queues it again. Returns 202 |

The detail route returns four things in one response on purpose. Four separate
calls would each read at their own moment, and a settlement landing between two
of them would put a pending payment on screen next to the ledger rows that
already paid the merchant. It runs at `REPEATABLE READ` so both of its queries
see one version of the database.

## Conventions

**Amounts are strings.** Always. See
[money-and-ledger.md](money-and-ledger.md#amounts-leave-as-strings).

**Timestamps are UTC ISO-8601.** Stored as `timestamptz`, formatted to local
time only in the UI.

**Unknown fields are rejected.** The validation layer runs with
`forbidNonWhitelisted`, so a body containing a field that is not in the DTO is a
400, not a silently ignored extra. That is what stops anybody smuggling in
`{"status": "PAID"}`.

**Rate limit.** Sixty requests a minute per address, and five a minute on login.
Over that is a 429.

## Errors

Standard NestJS shape.

```json
{ "message": "invalid api key", "error": "Unauthorized", "statusCode": 401 }
```

| Code | When |
| --- | --- |
| 400 | Malformed body, missing idempotency key, unknown field |
| 401 | Missing or revoked credential |
| 403 | Mode does not permit it, or a browser origin is not allowed |
| 404 | Not yours, or does not exist. These are the same answer on purpose |
| 409 | Conflicts with the current state |
| 422 | An idempotency key reused with a different body |
| 429 | Rate limited |
| 503 | That mode has no wallet configured on this deployment |

An unknown key and a revoked key both return `invalid api key`. Telling them
apart would say which guesses used to be real keys.
