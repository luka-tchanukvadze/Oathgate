import {
  IsIn,
  IsNumberString,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { SUPPORTED_CRYPTO, SUPPORTED_FIAT } from '@app/shared';

export class CreatePaymentDto {
  // Minor units as a string. no_symbols rejects a decimal point, so 10.50 is a
  // 400 and the only accepted form is 1050
  @IsNumberString({ no_symbols: true })
  fiatAmount!: string;

  @IsIn(SUPPORTED_FIAT)
  fiatCurrency!: string;

  @IsIn(SUPPORTED_CRYPTO)
  cryptoCurrency!: string;

  // The merchant's own order number. Capped to match the column, so an
  // oversized one is a 400 rather than a database error
  @IsOptional()
  @IsString()
  @MaxLength(64)
  reference?: string;
}
