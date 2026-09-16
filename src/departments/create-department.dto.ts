import { IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateDepartmentDto {
  @IsUUID()
  organizationId!: string;

  @IsString()
  @MaxLength(50)
  code!: string;

  @IsString()
  @MaxLength(255)
  name!: string;
}
