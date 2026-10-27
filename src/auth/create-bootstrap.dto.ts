import { IsEmail, IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateBootstrapDto {
  @IsString()
  @MinLength(24)
  @MaxLength(256)
  bootstrapSecret!: string;

  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fullName!: string;

  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password!: string;
}
