import { IsUUID } from 'class-validator';

export class CreateEmployeeAccountInviteDto {
  @IsUUID()
  personId!: string;
}
