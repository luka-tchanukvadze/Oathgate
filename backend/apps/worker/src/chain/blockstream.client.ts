import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ChainClient, ChainTransaction } from './chain.types';

// 10 seconds
// Generous for a slow explorer, and one address cannot hold up a whole sweep
const REQUEST_TIMEOUT_MS = 10_000;

const DEFAULT_BASE_URL = 'https://blockstream.info/testnet/api';

// A txid is 32 bytes printed as hex
const TXID = /^[0-9a-f]{64}$/i;

// My reading of an esplora transaction, not a type anyone publishes
// Every field is unknown until I have checked it
interface EsploraTransaction {
  txid?: unknown;
  status?: unknown;
  vout?: unknown;
}

interface EsploraStatus {
  confirmed?: unknown;
  block_hash?: unknown;
  block_height?: unknown;
}

interface EsploraVout {
  scriptpubkey_address?: unknown;
  value?: unknown;
}

@Injectable()
export class BlockstreamClient implements ChainClient {
  private readonly baseUrl: string;

  constructor(config: ConfigService) {
    const raw = config.get<string>('BLOCKSTREAM_API_URL') ?? DEFAULT_BASE_URL;

    this.baseUrl = raw.replace(/\/+$/, '');
  }

  // The height of the newest block
  // Esplora says which block a transaction is in and never its confirmations
  // Confirmations are tip minus that height plus one, so I need this too
  async tipHeight(): Promise<number> {
    const body = await this.get('/blocks/tip/height');
    const height = Number(body.trim());

    if (!Number.isInteger(height) || height < 0) {
      throw new Error(`tip height was not a number: ${body.slice(0, 40)}`);
    }

    return height;
  }

  async addressTransactions(address: string): Promise<ChainTransaction[]> {
    // The newest 50, mempool and confirmed mixed together
    // One invoice is paid by one or two, so the cap never bites here
    const body = await this.get(`/address/${encodeURIComponent(address)}/txs`);

    const parsed: unknown = JSON.parse(body);

    if (!Array.isArray(parsed)) {
      throw new Error('expected an array of transactions');
    }

    const transactions: ChainTransaction[] = [];

    for (const entry of parsed) {
      const transaction = this.parseTransaction(entry, address);

      if (transaction) {
        transactions.push(transaction);
      }
    }

    return transactions;
  }

  // Throws on anything that is not a clean 200, and that is the point
  // A caller must never read a failed request as an address nobody has paid
  private async get(path: string): Promise<string> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: { accept: 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`${path} returned ${response.status}`);
    }

    return response.text();
  }

  // A shape I did not expect is a skipped row, never a guessed amount
  private parseTransaction(
    entry: unknown,
    address: string,
  ): ChainTransaction | null {
    if (typeof entry !== 'object' || entry === null) {
      return null;
    }

    const tx = entry as EsploraTransaction;

    if (typeof tx.txid !== 'string' || !TXID.test(tx.txid)) {
      return null;
    }

    const amount = this.amountPaidTo(tx.vout, address);

    // This endpoint also returns transactions that spend from the address
    // Those pay me nothing and are history, not a payment
    if (amount === 0n) {
      return null;
    }

    const status = this.parseStatus(tx.status);

    return {
      txid: tx.txid.toLowerCase(),
      amount,
      blockHash: status.blockHash,
      blockHeight: status.blockHeight,
    };
  }

  private parseStatus(raw: unknown): {
    blockHash: string | null;
    blockHeight: number | null;
  } {
    if (typeof raw !== 'object' || raw === null) {
      return { blockHash: null, blockHeight: null };
    }

    const status = raw as EsploraStatus;

    // Still in the mempool, so there is no block to name yet
    // The transaction is returned anyway, because seen and unmined is a state
    if (status.confirmed !== true) {
      return { blockHash: null, blockHeight: null };
    }

    return {
      blockHash:
        typeof status.block_hash === 'string' ? status.block_hash : null,
      blockHeight:
        typeof status.block_height === 'number' &&
        Number.isInteger(status.block_height)
          ? status.block_height
          : null,
    };
  }

  // Only the outputs that pay my address
  // Taking vout[0] would credit whichever output happened to be listed first
  // That is usually the sender's own change, going back to the sender
  private amountPaidTo(vout: unknown, address: string): bigint {
    if (!Array.isArray(vout)) {
      return 0n;
    }

    let total = 0n;

    for (const entry of vout) {
      if (typeof entry !== 'object' || entry === null) {
        continue;
      }

      const output = entry as EsploraVout;

      if (output.scriptpubkey_address !== address) {
        continue;
      }

      // Satoshis arrive as a JSON number and turn into a bigint right here
      // This is the edge, and nothing past it sees a number again
      // 21 million BTC is 2.1e15 satoshis, well inside a safe integer
      if (
        typeof output.value !== 'number' ||
        !Number.isSafeInteger(output.value) ||
        output.value < 0
      ) {
        // Throwing rather than skipping
        // Crediting part of what someone paid is worse than crediting later
        throw new Error(`an output to ${address} had an unusable value`);
      }

      total += BigInt(output.value);
    }

    return total;
  }
}
