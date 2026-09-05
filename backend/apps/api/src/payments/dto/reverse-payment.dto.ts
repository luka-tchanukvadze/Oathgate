import { IsString, MaxLength, MinLength } from 'class-validator';

// Both doors send the same body, so both use this
// The dashboard takes its mode from the query string, the same as confirm
export class ReversePaymentDto {
  // Written into the payment.reversed event and read by whoever asks later why
  // the money went back, so an empty string is no use to anybody
  @IsString()
  @MinLength(3)
  @MaxLength(200)
  reason!: string;
}
