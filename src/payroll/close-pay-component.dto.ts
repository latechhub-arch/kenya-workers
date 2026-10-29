import { IsDateString } from 'class-validator';

export class ClosePayComponentDto {
  @IsDateString()
  effectiveTo!: string;
}
