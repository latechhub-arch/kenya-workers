import { EmploymentStatus } from '@prisma/client';
import { IsDateString, IsEnum, IsOptional, Matches } from 'class-validator';

export class UpdateEmploymentStatusDto {
  @IsEnum(EmploymentStatus)
  status!: EmploymentStatus;

  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  effectiveDate?: string;
}
