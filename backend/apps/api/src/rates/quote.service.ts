import { Injectable } from '@nestjs/common';
import { cryptoBaseUnits, fiatExponent, Prisma } from '@app/shared';
import { RatesService } from './rates.service';

// 15 minutes
// Long enough to open a wallet app
// Short enough that I am not underwriting a price move for free
const QUOTE_TTL_MS = 15 * 60_000;

// Matches the eighteen decimal places the quotedRate column keeps, so the
// number the quote is worked out from is the number that gets stored
const RATE_SCALE = 10n ** 18n;

export interface Quote {
  fiatAmount: bigint;
  fiatCurrency: string;
  cryptoAmount: bigint;
  cryptoCurrency: string;
  rate: Prisma.Decimal;
  expiresAt: Date;
}

@Injectable()
export class QuoteService {
  constructor(private readonly rates: RatesService) {}

  async quote(
    fiatAmount: bigint,
    fiatCurrency: string,
    cryptoCurrency: string,
  ): Promise<Quote> {
    const rate = await this.rates.getRate(fiatCurrency, cryptoCurrency);

    // The whole calculation is integers, because a Decimal division is capped
    // at a number of significant digits and quietly rounds past it. On a large
    // amount that lost satoshis, which is the one thing this project promises
    // not to do
    //
    // Scaling the rate by its own column precision is exact: decimal.js only
    // limits operations that can run forever, and multiplying is not one
    const scaledRate = BigInt(rate.mul(RATE_SCALE.toString()).toFixed(0));

    if (scaledRate <= 0n) {
      throw new Error(`refusing to quote at a rate of ${rate.toString()}`);
    }

    const numerator =
      fiatAmount * BigInt(cryptoBaseUnits(cryptoCurrency)) * RATE_SCALE;
    const divisor = 10n ** BigInt(fiatExponent(fiatCurrency)) * scaledRate;

    // Rounded up, so a fully paid invoice is never short
    // The customer pays at most one satoshi over, which is worth nothing
    // Rounding down leaves every payment slightly unpaid for ever
    const cryptoAmount = (numerator + divisor - 1n) / divisor;

    return {
      fiatAmount,
      fiatCurrency,
      cryptoAmount,
      cryptoCurrency,
      rate,
      expiresAt: new Date(Date.now() + QUOTE_TTL_MS),
    };
  }
}
