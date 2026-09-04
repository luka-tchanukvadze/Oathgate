# Testing

[Back to the README](../README.md)

```bash
cd backend
npm run test:e2e
```

Needs Postgres and Redis running, and Node 24 or newer. The reason for 24 is in
[deployment.md](deployment.md#the-pipeline).

Four suites, and one of them is the point.

## The concurrency test

Fifty settlements fire at one payment at the same moment. The test asserts that
exactly one ledger pair was written.

With the row lock in place: one winner, forty-nine `ConflictException`s, two
ledger rows, one `transferId`, entries netting to zero, balance correct, status
`PAID`, one outbox event.

Delete the `FOR UPDATE` and it fails with **ten winners**. No errors, no
exceptions, nothing in a log. Twenty ledger rows, and a merchant credited five
times for one coffee.

That is the failure mode worth understanding: a missing lock does not crash. It
produces plausible, wrong numbers, quietly, under load, and only under load.

### The first version of this test was worthless

It passed with the lock and it passed without it.

Fifty asynchronous calls do overlap in wall-clock time. What I had not thought
about is that JavaScript dispatches them roughly 25 milliseconds apart, and a
settlement finishes faster than that. Worker one was already done before worker
two asked the database anything. Nothing ever contended, so the lock was never
exercised, and the test proved nothing at all while looking like it proved
everything.

The fix is to make each settlement take longer than the gap between them. A
Prisma client extension adds 25 milliseconds to every query inside the test:

```ts
// Every query inside a settlement is slowed by this much
// Without it the fifty transactions are staggered further apart by javascript
// dispatch than a settlement takes to finish, so they never actually overlap
// and the test passes whether the row lock is there or not
const QUERY_DELAY_MS = 25;
```

Now they genuinely collide, and removing the lock genuinely fails.

The lesson generalises: a concurrency test that has never been seen to fail is
not a test. Break the thing it protects and watch it go red, or it is
decoration.

## The other three

**Idempotency**, four tests. The same key with the same body returns the first
response. The same key with a different body is a 422. A different key creates a
second payment. A concurrent duplicate does not create two.

**Webhook retries**, three tests. The first time phase 2's failure path had ever
actually run: a failing endpoint schedules the next attempt at the right time,
an exhausted delivery stops, and a replay raises the ceiling rather than
resetting the counter.

**The HTTP harness**, one test. Small, but it exists because getting the test
runner to load this codebase at all took three stacked fixes, and a smoke test
is what proves it stayed fixed.

## What the tests caught

**Postgres blank-pads `CHAR`.** The idempotency hash column is `CHAR(64)`, and a
made-up short hash in a test came back with 52 trailing spaces, which turned
every retry into a 422.

The real value is always a SHA-256 hex digest, which is exactly 64 characters,
so it fits with nothing left over. Nothing found that by reading the code.

**A timer that held the process open.** `Promise.race` does not cancel the
loser, so a health check's timeout kept running after the check returned. The
process would not exit and the test runner hung. The same bug had already been
fixed elsewhere in the codebase months earlier, which is its own lesson about
fixing a pattern rather than an instance.

## Getting the runner to work at all

Three problems stacked behind each other, each only visible once the one before
it was solved.

1. The jest config had no `moduleNameMapper`, so the monorepo path aliases meant
   nothing to it
2. The generated Prisma client imports with ESM `.js` specifiers, which jest's
   CommonJS resolver cannot follow to a `.ts` file on disk
3. Prisma 7 loads its query compiler through a dynamic `import()`, which jest
   refuses without `--experimental-vm-modules`

`test:e2e` invokes node directly with that flag rather than calling the `jest`
binary, because setting `NODE_OPTIONS` inline does not work in PowerShell.

There was a fourth attempt at a fix that made things worse: adding a
`test/tsconfig.json` to get the jest globals recognised. It dropped a global
type augmentation that nothing imports, and introduced `rootDir` errors. The
real fix was to delete it and import the globals explicitly:

```ts
import { describe, expect, it } from '@jest/globals';
```
