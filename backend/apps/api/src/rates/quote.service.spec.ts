import { describe, expect, it } from '@jest/globals';
import { Prisma } from '@app/shared';
import { QuoteService } from './quote.service';
import type { RatesService } from './rates.service';

const SATS = 10n ** 8n;
const RATE_SCALE = 10n ** 18n;

function quoteAt(rate: string): QuoteService {
  const rates = {
    getRate: () => Promise.resolve(new Prisma.Decimal(rate)),
  } as unknown as RatesService;

  return new QuoteService(rates);
}

// What a quote has to guarantee, stated without repeating how it is worked out:
// paying the quoted amount covers the invoice, and paying one unit less does
// not. Anything that satisfies both is the correct ceiling
function coversExactly(
  fiatAmount: bigint,
  cryptoAmount: bigint,
  rate: Prisma.Decimal,
) {
  const scaledRate = BigInt(rate.mul(RATE_SCALE.toString()).toFixed(0));
  const owed = fiatAmount * SATS * RATE_SCALE;
  const divisor = 100n * scaledRate;

  return {
    enough: cryptoAmount * divisor >= owed,
    nothingSmaller: (cryptoAmount - 1n) * divisor < owed,
  };
}

describe('QuoteService', () => {
  it('converts a coffee at a round rate', async () => {
    const quote = await quoteAt('300000').quote(1050n, 'GEL', 'BTC');

    expect(quote.cryptoAmount).toBe(3500n);
  });

  it('rounds up rather than down, so a paid invoice is never short', async () => {
    const quote = await quoteAt('300001').quote(1050n, 'GEL', 'BTC');

    // 3499.98 satoshis owed. Rounding down would leave every payment of this
    // amount permanently one satoshi underpaid
    expect(quote.cryptoAmount).toBe(3500n);
  });

  it('stays exact on an amount large enough to lose digits', async () => {
    const fiatAmount = 999_999_999_999_999_999n;
    const quote = await quoteAt('61234.567890123456789').quote(
      fiatAmount,
      'GEL',
      'BTC',
    );

    const { enough, nothingSmaller } = coversExactly(
      fiatAmount,
      quote.cryptoAmount,
      quote.rate,
    );

    expect(enough).toBe(true);
    expect(nothingSmaller).toBe(true);
  });

  it('is exact at the smallest amount there is', async () => {
    const quote = await quoteAt('61234.5').quote(1n, 'GEL', 'BTC');

    const { enough, nothingSmaller } = coversExactly(
      1n,
      quote.cryptoAmount,
      quote.rate,
    );

    expect(enough).toBe(true);
    expect(nothingSmaller).toBe(true);
  });

  // A rate of zero would divide by zero, and a negative one would quote a
  // negative amount. Neither should ever arrive, which is why it throws rather
  // than clamping
  it('refuses to quote at a rate of zero', async () => {
    await expect(quoteAt('0').quote(1050n, 'GEL', 'BTC')).rejects.toThrow(
      /refusing to quote/,
    );
  });
});
