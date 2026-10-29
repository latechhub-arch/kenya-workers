import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsNumber, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from 'class-validator';

export const PENSION_EVIDENCE_TYPES = ['RETIREMENT_NOTICE', 'SERVICE_RECORD', 'IDENTITY', 'BENEFICIARY_NOMINATION', 'DEATH_CERTIFICATE', 'OTHER'] as const;
export const PENSION_SCHEME_TYPES = ['PUBLIC_SERVICE_LEGACY', 'PUBLIC_SERVICE_SUPERANNUATION', 'KDF', 'NATIONAL_POLICE', 'COUNTY', 'OTHER'] as const;

export class CreatePensionSchemeDto {
  @IsUUID() organizationId!: string;
  @IsString() @MinLength(2) @MaxLength(50) code!: string;
  @IsString() @MinLength(2) @MaxLength(255) name!: string;
  @IsIn(PENSION_SCHEME_TYPES) schemeType!: (typeof PENSION_SCHEME_TYPES)[number];
  @IsOptional() @IsString() @MaxLength(3000) eligibilityPolicy?: string;
  @IsOptional() @IsString() @MaxLength(1000) officialSource?: string;
  @IsArray() @ArrayMaxSize(6) @IsIn(PENSION_EVIDENCE_TYPES, { each: true }) requiredEvidenceTypes!: (typeof PENSION_EVIDENCE_TYPES)[number][];
}

export class CreatePensionCaseDto {
  @IsUUID() employmentId!: string;
  @IsUUID() schemeId!: string;
  @IsString() @MinLength(10) @MaxLength(10) retirementDate!: string;
  @IsOptional() @Transform(({ value }) => value == null ? value : Number(value)) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100) qualifyingServiceYears?: number | null;
  @IsOptional() @Transform(({ value }) => value == null ? value : Number(value)) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100000000) proposedMonthlyAmount?: number | null;
  @IsOptional() @IsString() @MaxLength(3) currency?: string;
  @IsOptional() @IsString() @MaxLength(100) caseReference?: string;
}

export class CreatePensionEvidenceDto {
  @IsIn(PENSION_EVIDENCE_TYPES.filter((type) => type !== 'DEATH_CERTIFICATE')) evidenceType!: Exclude<(typeof PENSION_EVIDENCE_TYPES)[number], 'DEATH_CERTIFICATE'>;
  @IsString() @MinLength(2) @MaxLength(255) documentReference!: string;
}

export class ReviewPensionEvidenceDto {
  @IsIn(['VERIFIED', 'REJECTED']) decision!: 'VERIFIED' | 'REJECTED';
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}

export class ReviewPensionCaseDto {
  @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

export class ApprovePensionCaseDto {
  @Transform(({ value }) => Number(value)) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0) @Max(100000000) approvedMonthlyAmount!: number;
  @IsOptional() @IsString() @MaxLength(3) currency?: string;
  @IsString() @MinLength(5) @MaxLength(1000) approvalReference!: string;
}

export class EstimateLegacyPensionDto {
  @Transform(({ value }) => Number(value)) @IsNumber({ maxDecimalPlaces: 0 }) @Min(1) @Max(600) serviceMonths!: number;
  @Transform(({ value }) => Number(value)) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Max(100000000) finalAnnualPensionableEmoluments!: number;
  @IsOptional() @Transform(({ value }) => value == null || value === '' ? value : Number(value)) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Max(100000000) highestAnnualPensionableEmoluments?: number;
  @IsOptional() @Transform(({ value }) => value == null ? 0 : Number(value)) @IsNumber({ maxDecimalPlaces: 4 }) @Min(0) @Max(0.25) commutedFraction?: number;
}

export class EstimateSuperannuationDto {
  @Transform(({ value }) => Number(value)) @IsNumber({ maxDecimalPlaces: 2 }) @Min(0.01) @Max(1000000000) verifiedAccountBalance!: number;
}

export class RejectPensionCaseDto {
  @IsString() @MinLength(5) @MaxLength(2000) reason!: string;
}

export class ReportPensionerDeathDto {
  @IsString() @MinLength(10) @MaxLength(10) deathEffectiveDate!: string;
  @IsString() @MinLength(2) @MaxLength(255) deathCertificateReference!: string;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
}

export class ReviewPensionDeathDto {
  @IsIn(['VERIFIED', 'REJECTED']) decision!: 'VERIFIED' | 'REJECTED';
  @IsString() @MinLength(5) @MaxLength(2000) notes!: string;
}
