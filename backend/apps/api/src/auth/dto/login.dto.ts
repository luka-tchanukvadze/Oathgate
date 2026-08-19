import { IsEmail, IsString } from 'class-validator';

// The ! is because nothing in this file assigns these. The validation pipe
// builds the instance from the request body before a handler ever sees it
export class LoginDto {
  @IsEmail()
  email!: string;

  @IsString()
  password!: string;
}
