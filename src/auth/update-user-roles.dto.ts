import { IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { RoleAssignmentDto } from './role-assignment.dto';

export class UpdateUserRolesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RoleAssignmentDto)
  roles!: RoleAssignmentDto[];
}
