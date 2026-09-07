import { IsEnum, IsString, MaxLength, MinLength } from 'class-validator';
import { KeyMode } from '@app/shared';

export class SearchPaymentsDto {
  // Capped before it reaches a prompt, because tokens are the free tier limit
  // that actually binds and a long enough query is a way to burn the budget
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  q!: string;

  @IsEnum(KeyMode)
  mode!: KeyMode;
}
