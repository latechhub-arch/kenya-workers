import { EmploymentType } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateEmploymentDto {
  @IsString()
  @MaxLength(50)
  employmentNumber!: string;

  @IsUUID()
  personId!: string;

  @IsUUID()
  organizationId!: string;

  @IsEnum(EmploymentType)
  employmentType!: EmploymentType;

  @IsOptional()
  @IsDateString()
  appointmentDate?: string;

  @IsDateString()
  startDate!: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;
}
