import { Injectable } from '@nestjs/common';
import { cryptoBaseUnits, fiatExponent, Prisma } from '@app/shared';
import { RatesService } from './rates.service';

// 15 minutes. Long enough for someone to open a wallet app, short enough
// that I am not underwriting a large move in the price for free
const QUOTE_TTL_MS = 15 * 60_000;

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

    const divisor = new Prisma.Decimal(10)
      .pow(fiatExponent(fiatCurrency))
      .mul(rate);

    // Rounded up, so a fully paid invoice is never short. The customer pays at
    // most one base unit over the sticker price, which is worth nothing, while
    // rounding down would leave every payment slightly unpaid forever
    const amount = new Prisma.Decimal(fiatAmount.toString())
      .mul(cryptoBaseUnits(cryptoCurrency))
      .div(divisor)
      .ceil();

    return {
      fiatAmount,
      fiatCurrency,
      cryptoAmount: BigInt(amount.toFixed(0)),
      cryptoCurrency,
      rate,
      expiresAt: new Date(Date.now() + QUOTE_TTL_MS),
    };
  }
}
