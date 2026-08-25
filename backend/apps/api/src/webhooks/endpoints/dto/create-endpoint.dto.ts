import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { KeyMode } from '@app/shared';

export class CreateEndpointDto {
  @IsEnum(KeyMode)
  mode!: KeyMode;

  // Only length is checked here
  // Whether it is deliverable is assertDeliverableUrl's job
  @IsString()
  @MaxLength(2048)
  url!: string;

  // Empty means every event
  // Capped so nobody registers a thousand of them
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(20)
  events?: string[];
}
