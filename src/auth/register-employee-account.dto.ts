import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterEmployeeAccountDto {
  @IsString()
  @MinLength(32)
  @MaxLength(128)
  activationToken!: string;

  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password!: string;
}
