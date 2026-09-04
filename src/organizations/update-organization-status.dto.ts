import { OrganizationStatus } from '@prisma/client';
import { IsEnum } from 'class-validator';

export class UpdateOrganizationStatusDto {
  @IsEnum(OrganizationStatus)
  status!: OrganizationStatus;
}
