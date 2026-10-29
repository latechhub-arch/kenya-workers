import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class BudgetCoachMessageDto {
  @IsIn(['user', 'assistant'])
  role!: 'user' | 'assistant';

  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  content!: string;
}

export class AskBudgetCoachDto {
  @IsBoolean()
  consent!: boolean;

  @IsString()
  @MinLength(1)
  @MaxLength(1000)
  question!: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => BudgetCoachMessageDto)
  history?: BudgetCoachMessageDto[];
}
