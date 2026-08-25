import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { KeyMode, WebhookDeliveryStatus } from '@app/shared';

export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

export class ListDeliveriesDto {
  // A browser has a toggle, so mode is stated and validated, not inferred
  @IsEnum(KeyMode)
  mode!: KeyMode;

  // A count, not an amount, so a number is fine
  // Capped, because the caller does not decide how much memory I use
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_LIMIT)
  limit?: number;

  // The id of the last row the caller has
  // UUIDv7 sorts by time, so this needs no separate cursor column
  @IsOptional()
  @IsUUID()
  startingAfter?: string;

  @IsOptional()
  @IsEnum(WebhookDeliveryStatus)
  status?: WebhookDeliveryStatus;

  @IsOptional()
  @IsUUID()
  endpointId?: string;
}
