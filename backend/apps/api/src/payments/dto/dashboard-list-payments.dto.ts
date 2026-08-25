import { IsEnum } from 'class-validator';
import { KeyMode } from '@app/shared';
import { ListPaymentsDto } from './list-payments.dto';

// Same filters as the key list, plus the one thing a key carried itself
// A browser has a toggle, so mode is stated and validated, not inferred
export class DashboardListPaymentsDto extends ListPaymentsDto {
  @IsEnum(KeyMode)
  mode!: KeyMode;
}
