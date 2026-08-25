import { IsEmail, IsString } from 'class-validator';

// The ! is because the validation pipe builds this, not any code in here
export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}
