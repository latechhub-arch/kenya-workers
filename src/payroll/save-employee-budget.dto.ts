import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export const EMPLOYEE_BUDGET_CATEGORIES = [
  'HOUSING',
  'FOOD',
  'UTILITIES',
  'TRANSPORT',
  'FAMILY_SUPPORT',
  'HEALTH',
  'EDUCATION',
  'DEBT',
  'SAVINGS',
  'OTHER',
] as const;

export class EmployeeBudgetItemDto {
  @IsIn(EMPLOYEE_BUDGET_CATEGORIES)
  category!: (typeof EMPLOYEE_BUDGET_CATEGORIES)[number];

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  title!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100000000)
  monthlyAmount!: number;

  @IsOptional()
  @Transform(({ value }) => value === null || value === undefined ? value : Number(value))
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(1000000000)
  outstandingBalance?: number | null;
}

export class SaveEmployeeBudgetDto {
  @IsOptional()
  @Transform(({ value }) => value === null || value === undefined ? value : Number(value))
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(100000000)
  monthlyTakeHome?: number | null;

  @IsArray()
  @ArrayMaxSize(40)
  @ValidateNested({ each: true })
  @Type(() => EmployeeBudgetItemDto)
  items!: EmployeeBudgetItemDto[];
}
