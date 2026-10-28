import { IsOptional, IsUUID } from 'class-validator';

export class CompensationQueryDto {
  @IsOptional()
  @IsUUID()
  frameworkId?: string;
}
