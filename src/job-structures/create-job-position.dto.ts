import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateJobPositionDto {
  @IsUUID()
  organizationId!: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsUUID()
  frameworkId!: string;

  @IsUUID()
  levelId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title!: string;

  @IsInt()
  @Min(1)
  authorizedSlots!: number;
}
