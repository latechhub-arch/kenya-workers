import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  IsUUID,
} from 'class-validator';

export class CreatePersonDto {
  @IsOptional()
  @IsUUID()
  organizationId?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  personNumber: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  firstName: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  middleName?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  lastName: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;
}
