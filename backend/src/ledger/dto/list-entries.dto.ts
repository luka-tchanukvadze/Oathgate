import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { KeyMode } from '../../generated/prisma/client';

export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 200;

// mode is required, not optional. An API key is a mode, but a browser has a
// toggle, so on this side it has to arrive explicitly and be checked against
// the enum before it ever reaches a WHERE clause
export class ListEntriesDto {
  @IsEnum(KeyMode)
  mode!: KeyMode;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_LIMIT)
  limit?: number;

  @IsOptional()
  @IsUUID()
  startingAfter?: string;

  @IsOptional()
  @IsUUID()
  paymentId?: string;
}
