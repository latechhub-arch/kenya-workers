import { IsEnum } from 'class-validator';
import { PersonStatus } from '@prisma/client';

export class UpdatePersonStatusDto {
  @IsEnum(PersonStatus)
  status: PersonStatus;
}