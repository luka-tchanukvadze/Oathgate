# Architecture

[Back to the README](../README.md)

Three services, two databases, one repository.

## Why three services

The split is on **what starts the work**, not on subject matter.

| Service | Woken by | Why it is separate |
| --- | --- | --- |
| `api` | an HTTP request | Has to answer in milliseconds. Nothing slow belongs here |
| `worker` | a timer or a queued job | Polling a blockchain takes seconds and must not block a request |
| `notifications` | an event on a channel | Knows nothing about payments, only about events it is told |

A subject-matter split would have put "payments" in one service and "webhooks"
in another. That reads well and works badly, because a single payment then
crosses a network boundary three times before anyone is paid.

The rule that fell out of it: the api never schedules anything. NestJS's
`ScheduleModule` was removed from the api rather than left in place harmlessly,
because two api replicas would each run every cron job.

## Why two databases

`api` and `worker` share the payments database. They are two halves of one
system and they operate on the same rows.

`notifications` has its own. It receives events and sends emails. Giving it a
connection to the payments database would let it read a payment, and then one
day it would, and the boundary would be gone. A boundary that is only a
convention is not a boundary.

The cost is real and worth naming: there is no foreign key from a notification
back to a payment, and no join across the two. That is the trade.

## The outbox, and the problem it solves

The naive version:

```
BEGIN
  write ledger rows
  update the balance
COMMIT

publish "payment.completed"   <-- the process dies here
```

The money moved and nobody was told. Redis pub/sub keeps nothing and replays
nothing, so the event is gone for good. This is the dual-write problem: two
systems, one of which can fail after the other succeeded.

The fix is to make it one write:

```
BEGIN
  write ledger rows
  update the balance
  insert a row into outbox_event      <-- same transaction
COMMIT

a relay polls for unpublished rows and publishes them
```

Now the event is committed atomically with the money. If the relay dies, the
row is still there and gets published on the next pass.

The price is that delivery becomes **at-least-once**. The relay can publish and
then die before marking the row sent, so the same event goes out twice. Every
consumer has to be idempotent, and that is not an optional detail, it is the
contract.

### How the relay claims rows

`SELECT ... FOR UPDATE SKIP LOCKED`, not a bare `UPDATE`.

`SKIP LOCKED` tells Postgres to step over rows another transaction has already
locked instead of waiting for them. Two relay passes running at once then take
different rows rather than one blocking the other. Without it, a second worker
sits idle behind the first for as long as the first takes.

`publishedAt` means the relay is done with the row. It does not mean anybody
received anything.

## Communication

```
api  --BullMQ (Redis)-->  worker  --outbox + Redis pub/sub-->  notifications
```

**api to worker** is a queue, because the api wants the job to survive a
restart and wants it retried on failure.

**worker to notifications** is the outbox and then pub/sub, because
notifications is a subscriber that may not exist. Webhooks are the durable path
and live in Postgres, so the thing a merchant integrates against survives
everything. Email rides on top of that as a convenience.

Jobs are enqueued **after** the transaction commits. Enqueuing inside it means
a worker can pick up a job for a row that has not been written yet, or for a
transaction that then rolls back. Losing an enqueue is recoverable, because the
sweeps find the work anyway. A job for a payment that does not exist is not.

## The event contract

The internal event and the webhook body are different shapes on purpose.

The internal event is what one service tells another and can carry anything the
next service needs, including the merchant's email address. The webhook body is
a public API surface that a merchant writes code against, so it is a deliberate
projection with a version on it. Letting a merchant's integration break because
I added an internal field would be the worst kind of coupling.

The contract lives in its own library that imports nothing, so a consumer can
depend on the shape of an event without depending on Prisma, the database, or
anything else.

## Repository layout

```
backend/
  apps/
    api/            HTTP service
    worker/         queue consumer, cron, chain watcher
    notifications/  event consumer, its own Prisma schema
  libs/
    shared/         Prisma client, ledger, settlement, rates, queue
    contracts/      event shapes, importing nothing
frontend/           Next.js merchant dashboard
```

Folders are features, not layers. Everything auth-related is in `src/auth/`.
There is no top-level `guards/` holding guards from five different features.

Apps import the barrel `@app/shared`, never a path inside it. That keeps the
library free to move its own files around.

The build is one mirrored `dist` tree with `rootDir` pinned, not a bundler.
Prisma's generated client and its native pieces do not survive bundling
cleanly, and the debugging cost was not worth the smaller output.
