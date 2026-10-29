import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreatePayslipDto {
  @IsInt()
  @Min(2000)
  @Max(2200)
  periodYear!: number;

  @IsInt()
  @Min(1)
  @Max(12)
  periodMonth!: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  correctionReason?: string;
}
