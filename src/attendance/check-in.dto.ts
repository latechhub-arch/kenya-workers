import { IsBoolean, IsInt, IsNumber, IsOptional, Max, Min } from 'class-validator';

export class CheckInDto {
  @IsNumber({ maxDecimalPlaces: 7 })
  @Min(-90)
  @Max(90)
  latitude!: number;

  @IsNumber({ maxDecimalPlaces: 7 })
  @Min(-180)
  @Max(180)
  longitude!: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(10000)
  accuracyMeters!: number;

  @IsInt()
  @Min(0)
  locationCapturedAt!: number;

  @IsOptional()
  @IsBoolean()
  mockLocationDetected?: boolean;
}
