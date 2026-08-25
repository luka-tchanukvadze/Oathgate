import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { KeyMode } from '@app/shared';

export const DEFAULT_LIMIT = 50;
export const MAX_LIMIT = 200;

// mode is required here, not optional
// A key carries its own mode, a browser has a toggle
// So it arrives explicitly and is checked before reaching a WHERE clause
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
