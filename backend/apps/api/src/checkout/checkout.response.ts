import { type ChainTx, type Payment } from '@app/shared';

// Everything a customer standing at a till needs, and not one field more
//
// No merchantId, no apiKeyId, no mode, no ledger, no deliveries. The merchant's
// name and their own order number are both here because they are what tells a
// shopper they are paying the right person for the right thing
//
// Whoever holds a payment link is not authenticated, they just hold a link, so
// this shape is the whole boundary
export function toCheckoutResponse(
  payment: Payment & { chainTxs: ChainTx[]; merchant: { name: string } },
) {
  return {
    id: payment.id,
    status: payment.status,
    merchantName: payment.merchant.name,
    reference: payment.reference,
    fiatAmount: payment.fiatAmount.toFixed(0),
    fiatCurrency: payment.fiatCurrency,
    cryptoAmount: payment.cryptoAmount.toFixed(0),
    cryptoCurrency: payment.cryptoCurrency,
    address: payment.address,
    expiresAt: payment.expiresAt.toISOString(),
    createdAt: payment.createdAt.toISOString(),
    updatedAt: payment.updatedAt.toISOString(),
    // The deepest one, because that is the one that decides settlement
    confirmations: payment.chainTxs.reduce(
      (max, tx) => Math.max(max, tx.confirmations),
      0,
    ),
    // What has actually arrived, against the cryptoAmount above
    // A customer who sent half is still CONFIRMING, and without this the page
    // cannot tell them apart from one who sent all of it
    receivedAmount: payment.chainTxs
      .reduce((total, tx) => total + BigInt(tx.amount.toFixed(0)), 0n)
      .toString(),
    // Whether the button that stands in for a wallet is offered at all
    canSimulate: payment.mode === 'TEST',
  };
}
