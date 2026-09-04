import { type ChainTx } from '@app/shared';

export function toChainTxResponse(tx: ChainTx) {
  return {
    id: tx.id,
    txid: tx.txid,
    blockHash: tx.blockHash,
    amount: tx.amount.toFixed(0),
    currency: tx.currency,
    confirmations: tx.confirmations,
    seenAt: tx.seenAt.toISOString(),
  };
}
