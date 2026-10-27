import {
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateStationDto {
  @IsUUID()
  organizationId!: string;

  @IsOptional()
  @IsUUID()
  departmentId?: string;

  @IsString()
  @MaxLength(50)
  code!: string;

  @IsString()
  @MaxLength(255)
  name!: string;

  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100000)
  geofenceRadius?: number;
}
