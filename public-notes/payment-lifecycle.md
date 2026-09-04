# The payment lifecycle

[Back to the README](../README.md)

## The states

```
                  money seen on chain
   PENDING  ------------------------->  CONFIRMING
      |                                      |
      | 15 minutes, nothing arrived          | enough confirmations
      v                                      v
   EXPIRED                                 PAID
                                             |
                                             | confirmed money disappears
   UNDERPAID  <-- not enough, after an hour  v
                                          REVERSED
```

| Status | Means |
| --- | --- |
| `PENDING` | Created, nothing has arrived |
| `CONFIRMING` | Something arrived, not yet deep enough |
| `PAID` | Settled. Ledger written, merchant credited, webhook sent |
| `UNDERPAID` | Money arrived, an hour passed, still short |
| `EXPIRED` | The quote ran out and nothing ever arrived |
| `REVERSED` | It was `PAID` and the chain changed its mind |
| `FAILED` | Something went wrong that is not one of the above |

## The expiry sweep

A quote is held for fifteen minutes. After that the payment expires.

The sweep is one statement, and it only ever touches `PENDING` rows:

```sql
UPDATE payment SET status = 'EXPIRED'
WHERE status = 'PENDING' AND expires_at < now()
```

`PENDING` is the safe target precisely because it means **nothing arrived**. The
moment anything is seen on chain the payment leaves `PENDING`, so the sweep can
never expire a payment somebody has already paid. That single word in the
`WHERE` clause is what makes a bulk update safe to run on a timer.

Expiry is about the quote, not about the money. A payment that expires has
simply run out of the price it was promised. Anything that arrives afterwards is
still recorded against that payment, because the transactions are their own rows
and nothing about expiry deletes or hides them.

## Watching the chain

A worker polls an Esplora-compatible explorer every thirty seconds for the
addresses of payments that are not finished.

Three things about that loop are less obvious than they look.

### Only outputs paying this address count

A Bitcoin transaction can have many outputs. One of them pays the address that
was quoted, and the others are usually change going back to the sender. Summing
the whole transaction would credit the merchant with the customer's change.

So the client sums only the outputs whose script matches the address it asked
about.

### The explorer's answer is the whole truth, not an addition to it

This one cost real time to find.

A signet faucet paid a test payment, then replaced its own transaction thirty
seconds later, then again, and again. **Replace-by-fee**: an unconfirmed
transaction can be replaced by a new one that pays a higher fee, and the
replacement has a **different transaction id**.

The database had a unique constraint on `(txid, paymentId)`, which does exactly
nothing when every replacement brings a new txid. Nine rows accumulated,
summing to 1.3 million satoshis, for a payment that was going to receive
177,375.

The fix is a change of mental model. What the explorer returns for an address is
the complete current state of that address, not a list of new things. So each
pass deletes unconfirmed rows the explorer no longer returns:

```ts
await this.prisma.chainTx.deleteMany({
  where: { paymentId, blockHash: null, txid: { notIn: seen } },
});
```

with a guard: if the explorer returned a full page, the picture might be
truncated, and absence stops meaning gone. In that case nothing is deleted.

### Confirmations are a price, not a verdict

A confirmation is not a second opinion from the network. It is the number of
blocks stacked on top of the one containing the payment.

Reversing that payment means rebuilding every one of those blocks faster than
the rest of the network builds new ones. So the confirmation count is really a
statement about **cost**: how expensive it would be to undo this.

One confirmation is already far more than a coffee is worth stealing. Six
confirmations on a ten minute chain is an hour of a customer standing at a
counter. The threshold is a business decision dressed up as a technical one,
and this project sets it at one.

The threshold lives in one constant that both the settler and the reversal
detector import. They briefly did not, and one at 1 with the other at 2 means
every payment settles and then immediately reverses itself.

## Underpaid and overpaid

Chain transactions live in their own table, one row each, rather than as an
amount on the payment. That makes under and overpayment fall out of a `SUM`
rather than needing special cases.

**Overpaid** is credited to the merchant. The customer sent it, the merchant is
owed it. Keeping the difference would be the gateway quietly taking money.

**Underpaid** waits an hour before it is marked, because the rest of the money
may still be in flight. A customer paying from two wallets, or a wallet batching
its sends, is normal. After an hour it is a real shortfall and the merchant is
told.

Settlement credits **what actually arrived**, not what was owed, and refuses if
the arrived amount does not cover the owed amount.

## Reversals

A payment that is `PAID` can stop being paid.

A **chain reorganisation** is the network agreeing on a different history. A
block that existed gets orphaned, and the transactions in it go back to being
unconfirmed or vanish entirely.

Detecting that needs one thing that is easy to miss. A confirmed row that stops
being returned by the explorer has to be marked back to unconfirmed, or it keeps
its old block hash forever and still looks settled. The comparison between
credited money and confirmed money would then always agree, including in the one
case that matters.

So a row that disappears is unmarked, the sums disagree, and a check running
every minute writes the compensating reversal pair described in
[money-and-ledger.md](money-and-ledger.md).

Nothing is deleted. The merchant's balance returns to what it was, and the
history says a reversal happened and which entries it reversed.
