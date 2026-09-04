import { IsEnum } from 'class-validator';
import { KeyMode } from '@app/shared';
import { CreatePaymentDto } from './create-payment.dto';

// Same body a key sends, plus the one thing a key carried by itself
export class DashboardCreatePaymentDto extends CreatePaymentDto {
  @IsEnum(KeyMode)
  mode!: KeyMode;
}
