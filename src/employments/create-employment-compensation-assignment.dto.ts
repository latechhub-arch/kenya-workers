import { IsDateString, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateEmploymentCompensationAssignmentDto {
  @IsUUID()
  compensationStepId!: string;

  @IsDateString()
  effectiveFrom!: string;

  @IsString()
  @MaxLength(500)
  reason!: string;
}
