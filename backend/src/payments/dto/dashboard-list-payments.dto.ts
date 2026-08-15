import { IsEnum } from 'class-validator';
import { KeyMode } from '../../generated/prisma/client';
import { ListPaymentsDto } from './list-payments.dto';

// Same filters as the key-authenticated list, plus the one thing a key would
// have carried on its own. A browser has a test/live toggle, so mode has to be
// stated and validated instead of inferred
export class DashboardListPaymentsDto extends ListPaymentsDto {
  @IsEnum(KeyMode)
  mode!: KeyMode;
}
