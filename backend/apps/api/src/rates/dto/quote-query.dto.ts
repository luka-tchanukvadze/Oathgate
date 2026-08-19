import { IsIn, IsNumberString } from 'class-validator';
import { SUPPORTED_CRYPTO, SUPPORTED_FIAT } from '@app/shared';

export class QuoteQueryDto {
  // A string, not a number. Once a JS number touches an amount it is a double,
  // and no_symbols also rejects a decimal point, which forces minor units
  @IsNumberString({ no_symbols: true })
  fiatAmount!: string;

  @IsIn(SUPPORTED_FIAT)
  fiatCurrency!: string;

  @IsIn(SUPPORTED_CRYPTO)
  cryptoCurrency!: string;
}
