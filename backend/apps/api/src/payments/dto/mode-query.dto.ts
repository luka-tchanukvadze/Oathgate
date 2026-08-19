import { IsEnum } from 'class-validator';
import { KeyMode } from '@app/shared';

export class ModeQueryDto {
  @IsEnum(KeyMode)
  mode!: KeyMode;
}
