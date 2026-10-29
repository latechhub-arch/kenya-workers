import { PayComponentFrequency, PayComponentType } from '@prisma/client';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';

export class CreatePayComponentDto {
  @IsString()
  @Matches(/^[A-Z0-9_-]+$/)
  @MaxLength(50)
  code!: string;

  @IsString()
  @MaxLength(255)
  title!: string;

  @IsEnum(PayComponentType)
  type!: PayComponentType;

  @IsOptional()
  @IsEnum(PayComponentFrequency)
  frequency?: PayComponentFrequency;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  currency?: string;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount!: number;

  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  balance?: number;

  @IsDateString()
  effectiveFrom!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
