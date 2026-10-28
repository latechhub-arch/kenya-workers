import { IsDateString } from 'class-validator';

export class CloseCompensationScaleDto {
  @IsDateString()
  effectiveTo!: string;
}
