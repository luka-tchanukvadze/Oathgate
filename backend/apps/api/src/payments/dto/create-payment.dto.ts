import {
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { SUPPORTED_CRYPTO, SUPPORTED_FIAT } from '@app/shared';

// Minor units as a string, one to eighteen digits, no leading zero
//
// The leading digit cannot be 0, which rejects both "0" and "007". A payment
// for nothing is not a payment, and it would quote at zero satoshis and settle
// against an address nobody ever pays
//
// Eighteen digits because the column is Decimal(38, 0) and the quote multiplies
// this by a hundred million on its way to satoshis. A longer number passed
// validation and then failed at the write, or worse arrived rounded
const MINOR_UNITS = /^[1-9]\d{0,17}$/;

export class CreatePaymentDto {
  // A decimal point is a 400, so 10.50 GEL arrives as 1050
  @Matches(MINOR_UNITS)
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
