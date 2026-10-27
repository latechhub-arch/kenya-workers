import { JobFrameworkType } from '@prisma/client';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';

export class CreateJobFrameworkDto {
  @IsUUID()
  organizationId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  name!: string;

  @IsEnum(JobFrameworkType)
  type!: JobFrameworkType;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string;
}
