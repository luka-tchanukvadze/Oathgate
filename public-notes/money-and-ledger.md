# Money and the ledger

[Back to the README](../README.md)

## Never a float

`0.1 + 0.2 !== 0.3` in JavaScript, and in most other languages, because binary
floating point cannot represent those values exactly. In a display that is a
rounding artefact. In a ledger it is a real loss that compounds.

So there is no `Float`, no `Double`, and no JavaScript `number` anywhere near an
amount. Not in the schema, not in a DTO, not in a test fixture.

**Fiat is integer minor units.** 10.50 GEL is stored as `1050`, with the
currency code beside it. There is no decimal fiat amount anywhere in the system.

**Crypto is integer base units.** Satoshis, not bitcoin. 0.00003692 BTC is
stored as `3692`.

**Every amount carries its currency.** There is no bare `amount` field.

Conversion happens only at the edges. Amounts are parsed into integers on the
way in and formatted for display on the way out. The middle of the system only
ever sees whole numbers.

### Why `Decimal(38, 0)` and not `BigInt`

Postgres `BIGINT` is 64 bits, which holds about 9.2 quintillion. That is enough
for satoshis today and stops being enough for a chain with 18 decimal places.
One wei is 10^-18 ether, so a single ether is 10^18 wei, and a few thousand
ether overflows.

`Decimal(38, 0)` is 38 digits with nothing after the point. It is an exact
integer type with room for any base unit I am likely to meet, and it does not
need a migration the first time a second chain is added.

The zero scale is the important half. A `Decimal` with decimal places would
quietly reintroduce the thing this is all avoiding.

### Amounts leave as strings

Every amount in a JSON response is a string.

```json
{ "fiatAmount": "1050", "cryptoAmount": "3692" }
```

A JSON number is a double on the other side. `JSON.parse` on a large satoshi
value silently loses precision, and the consumer has no way to know it
happened. A string forces the reader to decide how to handle it.

The formatter is `toFixed(0)`, not `toString`. A large enough `Decimal` prints
as `1e+21` with `toString`, and satoshis get there.

## Double entry

Every movement of money writes **two** rows that sum to zero.

Settling a 3692 satoshi payment writes:

| Account | Direction | Amount |
| --- | --- | --- |
| Gateway wallet | DEBIT | 3692 |
| Merchant balance | CREDIT | 3692 |

Both rows share a `transferId`. A group sharing a `transferId` must sum to
zero, and that is checkable at any time with one query. If it does not sum to
zero, something wrote a half-movement, and that is a bug you can find rather
than a discrepancy you discover in a month.

**Amounts are always positive.** Direction is its own column rather than a sign
on the number. A negative amount can be produced by an arithmetic mistake and
looks like data. A `DEBIT` cannot be produced by accident.

**Accounts have a kind.** `GATEWAY_WALLET`, `FEES` and `MERCHANT_BALANCE`. The
first two are house accounts and belong to nobody, so their `merchantId` is
null. Every merchant movement has a house account on the other side of it, which
is what makes the two-row rule possible in the first place.

## Append-only

A `LedgerEntry` is never updated and never deleted.

To undo something, a reorg or a refund, the system writes a **compensating
reversal pair**: the same two rows with the directions flipped, each pointing at
the original entry it reverses.

```
original    DEBIT  gateway 3692        CREDIT merchant 3692
reversal    CREDIT gateway 3692        DEBIT  merchant 3692
```

The `reversesId` column is unique, so an entry can be reversed exactly once. A
second attempt is a constraint violation rather than a double reversal.

The balance ends up back where it started, and the history says what happened
and when. A `DELETE` would have left the same balance and no history at all.

**The balance column is a cached projection.** It exists because summing every
entry on every read does not scale. It is not the source of truth, and it must
always be re-derivable by summing the entries. Any reconciliation job that finds
a difference between the two has found a bug.

## The lock

Settlement runs inside a transaction that begins by locking the account row:

```sql
SELECT * FROM account WHERE id = $1 FOR UPDATE
```

`FOR UPDATE` takes a row-level lock that is held until the transaction commits.
A second transaction that asks for the same row waits.

Without it, two settlements for one payment can both read a balance of 0, both
add 3692, and both write 3692. The merchant is paid once and credited twice.

This is the one place in the system that uses raw SQL rather than Prisma's
query builder. Prisma has no `FOR UPDATE`, and the alternative, a serializable
isolation level with retry loops, is more machinery for a weaker guarantee.

There is a test that proves the lock does something. It is described in
[testing.md](testing.md), and the first version of it was worthless.

## Quotes

A quote rounds **up**, always, in the gateway's favour.

Charging 10.50 GEL at some rate gives a satoshi amount that is almost never a
whole number. Rounding down means the gateway is short by a fraction on every
single payment, and a fraction times a million payments is a real number.

Rounding up means the customer overpays by at most one satoshi, which is worth
approximately nothing to them.

The quote is held for fifteen minutes and the rate is frozen on the payment row.
The customer pays what they were quoted even if the market moves, and the
gateway carries that risk for fifteen minutes rather than the merchant carrying
it forever.

**The ledger never converts.** It records satoshis moving between satoshi
accounts. What those satoshis were worth in GEL is on the payment, not in the
books. A ledger that converts is a ledger whose history changes when the market
does.
