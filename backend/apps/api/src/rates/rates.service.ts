import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@app/shared';

// 1 minute
// The free upstream tier rate-limits hard
// A price is not meaningfully staler at 59 seconds than at 1
const FRESH_MS = 60_000;

// 10 minutes
// How stale a cached price I will still quote while the upstream is down
// Past that I would rather refuse than promise a number I cannot defend
const STALE_CEILING_MS = 10 * 60_000;

const UPSTREAM_IDS: Record<string, string> = {
  BTC: 'bitcoin',
};

interface CachedRate {
  rate: Prisma.Decimal;
  fetchedAt: number;
}

@Injectable()
export class RatesService {
  private readonly logger = new Logger(RatesService.name);

  // In process, because phase 1 was one process
  // This wants to move to Redis now that two processes could disagree
  private readonly cache = new Map<string, CachedRate>();

  constructor(private readonly config: ConfigService) {}

  async getRate(
    fiatCurrency: string,
    cryptoCurrency: string,
  ): Promise<Prisma.Decimal> {
    const key = `${cryptoCurrency}/${fiatCurrency}`;
    const cached = this.cache.get(key);
    const now = Date.now();

    if (cached && now - cached.fetchedAt < FRESH_MS) {
      return cached.rate;
    }

    try {
      const rate = await this.fetchRate(fiatCurrency, cryptoCurrency);
      this.cache.set(key, { rate, fetchedAt: now });

      return rate;
    } catch (error) {
      if (cached && now - cached.fetchedAt < STALE_CEILING_MS) {
        this.logger.warn(`serving a stale ${key} rate, upstream is failing`);

        return cached.rate;
      }

      this.logger.error(`no usable ${key} rate: ${String(error)}`);
      throw new ServiceUnavailableException('no usable exchange rate');
    }
  }

  private async fetchRate(
    fiatCurrency: string,
    cryptoCurrency: string,
  ): Promise<Prisma.Decimal> {
    const id = UPSTREAM_IDS[cryptoCurrency];

    if (!id) {
      throw new Error(`no upstream id for ${cryptoCurrency}`);
    }

    const vsCurrency = fiatCurrency.toLowerCase();
    const url = new URL('https://api.coingecko.com/api/v3/simple/price');
    url.searchParams.set('ids', id);
    url.searchParams.set('vs_currencies', vsCurrency);

    const apiKey = this.config.get<string>('COINGECKO_API_KEY');

    const response = await fetch(url, {
      headers: apiKey ? { 'x-cg-demo-api-key': apiKey } : {},
      // Without a deadline a hung upstream holds a payment request open
      signal: AbortSignal.timeout(5_000),
    });

    if (!response.ok) {
      throw new Error(`upstream answered ${response.status}`);
    }

    const body = (await response.json()) as Record<
      string,
      Record<string, number> | undefined
    >;

    const price = body[id]?.[vsCurrency];

    if (typeof price !== 'number' || !Number.isFinite(price)) {
      throw new Error(
        `upstream has no ${cryptoCurrency}/${fiatCurrency} price`,
      );
    }

    // The double exists for exactly one line
    // JSON has no other number type, and a price never needs that precision
    return new Prisma.Decimal(price);
  }
}
