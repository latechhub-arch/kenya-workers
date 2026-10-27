import { IsDateString, IsNotEmpty, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateEmploymentPositionAssignmentDto {
  @IsUUID()
  positionId!: string;

  @IsDateString()
  effectiveFrom!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  reason!: string;
}
