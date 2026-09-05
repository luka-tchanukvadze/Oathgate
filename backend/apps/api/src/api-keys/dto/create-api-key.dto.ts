import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';
import { KeyMode } from '@app/shared';

export class CreateApiKeyDto {
  // Capped to the column, so an oversized name is a 400 and not a write error
  @IsString()
  @MinLength(1)
  @MaxLength(64)
  name!: string;

  @IsEnum(KeyMode)
  mode!: KeyMode;
}
