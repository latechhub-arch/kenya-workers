import { EmploymentStatus } from '@prisma/client';

export class UpdateEmploymentStatusDto {
  status!: EmploymentStatus;
}
