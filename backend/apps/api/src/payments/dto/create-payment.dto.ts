import {
  IsIn,
  IsNumberString,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { SUPPORTED_CRYPTO, SUPPORTED_FIAT } from '@app/shared';

export class CreatePaymentDto {
  // Minor units as a string
  // no_symbols rejects a decimal point, so 10.50 is a 400 and 1050 is not
  // 10.50 GEL therefore arrives as 1050
  @IsNumberString({ no_symbols: true })
  fiatAmount!: string;

  @IsIn(SUPPORTED_FIAT)
  fiatCurrency!: string;

  @IsIn(SUPPORTED_CRYPTO)
  cryptoCurrency!: string;

  // The merchant's own order number
  // Capped to the column, so an oversized one is a 400 not a write error
  @IsOptional()
  @IsString()
  @MaxLength(64)
  reference?: string;
}
