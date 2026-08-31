// What I need from a block explorer, and nothing beyond it
// Esplora is an API shape rather than one company, and mempool.space serves the
// same one, so a bad week for a provider is a config change and not a rewrite
export interface ChainClient {
  addressTransactions(address: string): Promise<ChainTransaction[]>;
  tipHeight(): Promise<number>;
}

// One transaction, already reduced to the part that concerns one address
export interface ChainTransaction {
  txid: string;

  // Satoshis paid to the address I asked about, not the transaction total
  // Almost every transaction also pays change back to the sender
  amount: bigint;

  // Both null while it is still in the mempool
  // The hash is what makes a reorg visible: same height, different hash
  blockHash: string | null;
  blockHeight: number | null;
}
