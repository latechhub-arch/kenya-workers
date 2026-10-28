import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsBoolean,
  IsArray,
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

export class CreateCompensationStepDto {
  @IsUUID()
  jobLevelId!: string;

  @IsInt()
  @Min(1)
  stepNumber!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  basicSalary!: number;
}

export class CreateCompensationScaleDto {
  @IsUUID()
  frameworkId!: string;

  @IsString()
  @Matches(/^[A-Za-z0-9_-]+$/)
  @MaxLength(50)
  code!: string;

  @IsString()
  @MaxLength(255)
  name!: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  currency = 'KES';

  @IsOptional()
  @IsBoolean()
  isProvisional = false;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  source?: string;

  @IsDateString()
  effectiveFrom!: string;

  @IsOptional()
  @IsDateString()
  effectiveTo?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateCompensationStepDto)
  steps!: CreateCompensationStepDto[];
}
