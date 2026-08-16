import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { KeyMode } from '../../generated/prisma/client';

export class CreateEndpointDto {
  @IsEnum(KeyMode)
  mode!: KeyMode;

  // Only length is checked here. Whether it is deliverable depends on the mode
  // and on where it points, which is a job for assertDeliverableUrl
  @IsString()
  @MaxLength(2048)
  url!: string;

  // Empty means every event. Capped so nobody registers a thousand of them
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(20)
  events?: string[];
}
