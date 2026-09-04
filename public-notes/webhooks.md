# Webhooks

[Back to the README](../README.md)

A webhook is how the shop finds out the coffee got paid for.

It matters more than it sounds. The customer's browser coming back to the shop
after paying is a nice-to-have: they can close the tab, lose signal, or pay and
walk away. The server-to-server webhook is the fact.

## What arrives

```http
POST /your/endpoint HTTP/1.1
content-type: application/json
oathgate-event: payment.completed
oathgate-delivery: 0198f0c4-...
oathgate-signature: t=1755432000,v1=8f3a2c1e4b...
```

```json
{
  "id": "0198f0c4-...",
  "type": "payment.completed",
  "created": "2026-09-04T12:04:11.000Z",
  "data": {
    "paymentId": "0198f0c2-...",
    "reference": "order-4417",
    "status": "PAID",
    "fiatAmount": "1050",
    "fiatCurrency": "GEL",
    "fiatExponent": 2,
    "cryptoAmount": "3692",
    "cryptoCurrency": "BTC"
  }
}
```

`fiatExponent` is there so a consumer can format without a currency table.
`1050` with an exponent of `2` comes out as `10.50`. Some currencies have three
decimal places and some have none, and making every consumer know that is
making every consumer get it wrong.

## Verifying the signature

The header is Stripe's shape, copied on purpose, because it is a shape people
already know.

```
oathgate-signature: t=1755432000,v1=8f3a2c1e4b...
```

The signed string is **`timestamp.body`**, not just the body:

```js
const signed = `${t}.${rawBody}`;
const expected = crypto.createHmac('sha256', secret).update(signed).digest('hex');
```

Two things to get right when you implement this.

**Use the raw body bytes, not a re-serialized object.** Parsing JSON and
stringifying it again can reorder keys or change whitespace, and the signature
is over exact bytes.

**Compare in constant time.** `crypto.timingSafeEqual`, not `===`. A normal
string comparison returns as soon as it finds a difference, and the time it took
leaks how many leading characters were correct. That is enough to recover a
signature one character at a time.

### Why the timestamp is in the signature

Without it, a captured request stays valid forever. Anyone who once saw a
`payment.completed` body and its signature could replay it at any point in the
future and the shop would mark another order paid.

With the timestamp inside the signed string, changing it invalidates the
signature, so an attacker cannot make an old capture look recent. Reject
anything older than a few minutes and a replay window closes.

The `v1=` prefix leaves room to change algorithm later without breaking every
existing integration on the same day.

## Retries

| Attempt | Waits |
| --- | --- |
| 1 | immediate |
| 2 | 10 seconds |
| 3 | 1 minute |
| 4 | 5 minutes |
| 5 | 30 minutes |
| 6 | 2 hours |
| 7 | 6 hours |

Seven attempts, about nine hours in total. An endpoint that is briefly down
loses nothing. An endpoint that is down for a working day still gets its event
when it comes back.

The schedule is a list rather than a formula, so one number can be changed
without moving all the others.

**Retries are scheduled in Postgres, not in Redis.** A `nextAttemptAt` column
and a sweep that picks up rows whose time has come. A queue's own delay
mechanism would put the retry schedule in a place that does not survive a Redis
restart, and the delivery log has to survive.

**The processor never throws.** A failure is an outcome to record, not an
exception to propagate. A thrown error would let the queue apply its own retry
policy on top of this one, and then there are two schedules disagreeing about
when the next attempt is.

## At-least-once, and what that means for you

The same event can arrive twice. Not often, but by design rather than by
accident: the outbox relay can publish and then die before marking the row sent.

**Deduplicating is the receiver's job.** Store the `oathgate-delivery` id, or
the event `id`, and ignore one you have already processed. There is no way to
build exactly-once delivery over a network, and pretending otherwise just moves
the problem somewhere it is harder to see.

## The delivery log

Every attempt is its own row, not a counter.

A counter says a delivery failed four times. The rows say the first attempt got
a 500, the second timed out, the third got a 502, and the fourth got a 200. When
a merchant asks why their integration is flaky, the second version is an answer.

The dashboard shows the exact body that was signed, the signature that was sent,
every attempt with its response code and duration, and when the next one is due.

**The payload is frozen at fan-out.** The body is serialized once, when the
delivery row is created, and every retry sends those same bytes. Rebuilding it
per attempt would mean a retry sending a different message under a valid
signature, which is worse than not retrying at all.

## Replay

The dashboard can replay a delivery.

Replay **raises the attempt ceiling** rather than resetting the counter to zero.
Resetting would collide with the attempt log's own numbering, and there would be
two attempt 1s that mean different things. `maxAttempts` is a budget, and a
replay increases the budget.

## Where a webhook can point

A merchant chooses their own URL, and that URL is fetched by a server inside my
network. That is server-side request forgery if it is not checked.

The obvious target is a cloud metadata endpoint, which on many providers hands
out credentials to anything that asks from inside the machine.

So the URL is checked when it is registered and again immediately before every
send. Private ranges, loopback and link-local addresses are refused, and a
hostname is resolved so that every address it answers with is checked too. A
name is not an address, and whoever owns it can repoint it at any time, so
checking only what the merchant typed would check the wrong thing.

Redirects are not followed, because a URL that passed the check can still answer
with a 302 pointing somewhere that would not have.

One detail that caught me: an IPv6 literal in a URL is wrapped in brackets,
`http://[::1]/`, and the brackets have to come off before the address is parsed.
Without that, `[::1]` is not recognised as loopback and the check passes.
