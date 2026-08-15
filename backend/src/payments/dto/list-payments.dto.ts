import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaymentStatus } from '../../generated/prisma/client';

export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

export class ListPaymentsDto {
  // A count, not an amount, so a number is fine here. Capped, because the
  // caller does not get to decide how much memory my process uses
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_LIMIT)
  limit?: number;

  // The id of the last row the caller already has. Ids are UUIDv7, so sorting
  // by id is sorting by time and this needs no separate cursor column
  @IsOptional()
  @IsUUID()
  startingAfter?: string;

  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @IsOptional()
  @IsString()
  @MaxLength(64)
  reference?: string;
}
