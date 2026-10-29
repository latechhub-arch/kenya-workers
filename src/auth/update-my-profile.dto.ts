import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpdateMyProfileDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  fullName!: string;
}
