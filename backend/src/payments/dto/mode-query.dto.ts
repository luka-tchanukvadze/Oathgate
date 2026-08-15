import { IsEnum } from 'class-validator';
import { KeyMode } from '../../generated/prisma/client';

export class ModeQueryDto {
  @IsEnum(KeyMode)
  mode!: KeyMode;
}
