# Security

[Back to the README](../README.md)

This is a payments API, so the bar is higher than for most portfolio projects.
What follows is what is built, and at the end, what is not.

## Tenant isolation

The most common real API bug, and in a payments API the worst one, is **IDOR**:
insecure direct object reference. Merchant A passes merchant B's payment id and
reads it.

```ts
// A hole
findUnique({ where: { id } })

// The rule
findFirst({ where: { id, merchantId, mode } })
```

No library fixes this. It is discipline applied at every single query, and the
rule here is that a row is never looked up by id alone. Always `merchantId`, and
always `mode` alongside it.

Without `merchantId`, a caller reads somebody else's payments. Without `mode`, a
live dashboard shows test money, or worse, a test key reaches a live row.

"Not yours" and "does not exist" return the same 404 on purpose. Different
answers would let someone enumerate which ids are real.

There is one place this looks redundant and is not. The dashboard's confirm
route does a scoped read whose result is thrown away:

```ts
await this.payments.get(session.merchantId, query.mode, id);
```

Without it, a live payment id sent with `?mode=TEST` would clear the test-only
check and settle real money. The discarded read is what turns that into a 404.

## Credentials

### API keys

Stored as **SHA-256**, not bcrypt or argon2.

That sounds wrong, and the reasoning is the difference between a password and a
key. A password is low entropy, chosen by a human, and guessable, so it needs a
slow hash with a random salt to make guessing expensive.

An API key is 24 random bytes that I generated. There is nothing to guess. What
it needs is to be **looked up on every single request**, and a random salt would
mean no index and a full table scan per call.

So the key is hashed once and the hash is indexed. The presented key is hashed
and looked up. Nothing is ever compared as a string, which means there is no
string comparison to leak timing.

A stolen database dump contains no working credentials.

The plain key is shown exactly once, at creation, and never again. What is kept
alongside the hash is a 16 character prefix, `sk_test_a1b2c3d4`, so a merchant
can tell their keys apart in a list.

An unknown key and a revoked key return the same message. Telling them apart
would say which guesses used to be real keys.

### Passwords

**argon2id**, at OWASP's floor: 19456 KiB of memory, two passes.

The memory cost is the part that matters. It is what makes a GPU attack
expensive, because a graphics card has thousands of cores and not much memory
per core. A slow loop alone parallelises. A memory-hungry one does not.

### Sessions

A **row in Postgres**, not a JWT.

A JWT cannot be revoked. Once it is issued it is valid until it expires, so
signing out is a lie the client tells itself, and a stolen token stays good.
Short expiries plus refresh tokens get some of it back and add real complexity.

A session row can be deleted. Signing out actually signs you out, and so does
revoking someone else's session.

The cost is a database read per request, which is one indexed primary key lookup
on the same connection everything else uses.

The token in the cookie is stored as **SHA-256**, same reasoning as the API key.

The cookie is `httpOnly`, `sameSite: lax`, and `secure` in production.
`httpOnly` means JavaScript cannot read it, so an XSS bug cannot steal a
session.

## The guards

Three of them, applied in this order.

**Rate limiting.** Sixty requests a minute per address, five a minute on login.
Argon2 makes one password guess slow, and this stops someone paying that cost in
parallel across a thousand connections.

The guard is registered globally rather than per route. Registering the module
alone only makes the guard available, so a limit that is not applied globally
quietly covers nothing but the routes that name it.

**Origin.** On cookie-authenticated routes only, and only on unsafe methods. A
browser attaches cookies automatically, which is what makes CSRF possible:
another site can make your browser send an authenticated request. So a request
to `/api/dashboard/*` that carries an `Origin` header from somewhere unexpected
is refused.

An absent `Origin` is allowed, because that means a non-browser client, and a
non-browser client cannot hold the cookie in the first place. `/api/v1/*` is
exempt entirely, since a browser never attaches an API key on its own.

**Authentication.** Either the API key guard or the session guard, never both on
one route. See [api.md](api.md#two-ways-in-and-they-never-share-a-route).

## Input

The validation layer runs with `whitelist` and `forbidNonWhitelisted`, so any
field not declared in a DTO is rejected rather than ignored. That is what stops
`{"status": "PAID"}` from being smuggled into a create request.

Every amount arrives as a string of digits with no symbols, so a decimal point
is a 400 before it reaches any arithmetic.

## Outbound requests

A merchant chooses the URL their webhooks go to, and a server inside my network
fetches it. That is SSRF if unchecked. What is checked, and why redirects
are not followed, is in [webhooks.md](webhooks.md#where-a-webhook-can-point).

## The deployment

The database and Redis publish **no host ports at all** in production. They are
reachable only from the other containers on the same Docker network. Locally
they are bound to loopback, never to every interface.

The application container runs as a non-root user and is not privileged.

Nothing reaches the machine directly. A tunnel makes an outbound connection to
Cloudflare, so there is no inbound port open and the origin address is never
exposed.

`.env` and every secret file are gitignored and always have been. No secret is
in the repository or in its history.

`NODE_ENV=production` in the image, so stack traces with file paths in them are
never returned to a caller.

## Scope

Signet only. The live wallet key is not configured on the deployed instance, so
a request for a live payment stops before anything reaches the database.
