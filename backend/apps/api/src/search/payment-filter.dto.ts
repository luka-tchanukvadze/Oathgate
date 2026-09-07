import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaymentStatus, SUPPORTED_FIAT } from '@app/shared';

// Whole units with at most two decimals, which is what a person types
// The model never multiplies anything up: I convert to minor units myself,
// because arithmetic is the one job a language model should not be given
const AMOUNT = /^\d{1,12}(\.\d{1,2})?$/;

// Every field a filter is allowed to carry
// What the model answers is checked against this before anything reads it, so
// a field it invented has nowhere to land
export class PaymentFilterDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(7)
  @IsEnum(PaymentStatus, { each: true })
  status?: PaymentStatus[];

  @IsOptional()
  @IsIn(SUPPORTED_FIAT)
  fiatCurrency?: string;

  @IsOptional()
  @IsString()
  @Matches(AMOUNT)
  minAmount?: string;

  @IsOptional()
  @IsString()
  @Matches(AMOUNT)
  maxAmount?: string;

  // A window backwards from now, not two dates
  // Asking a model to work out what last Tuesday was is a way to get a wrong
  // answer that still parses
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365)
  withinDays?: number;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  reference?: string;
}
