import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import {
  KeyMode,
  WebhookDeliveryStatus,
} from '../../../generated/prisma/client';

export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

export class ListDeliveriesDto {
  // A browser has a test/live toggle, so mode is stated and validated rather
  // than inferred off a key the way the merchant-facing API does it
  @IsEnum(KeyMode)
  mode!: KeyMode;

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
  @IsEnum(WebhookDeliveryStatus)
  status?: WebhookDeliveryStatus;

  @IsOptional()
  @IsUUID()
  endpointId?: string;
}
