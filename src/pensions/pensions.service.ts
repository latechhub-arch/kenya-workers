import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { EmploymentStatus, PensionCaseStatus, PensionEvidenceStatus, PensionScheduleStatus, Prisma } from '@prisma/client';
import { assertOrganizationPermission, organizationIdsForPermission } from '../auth/organization-access';
import { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import {
  ApprovePensionCaseDto,
  CreatePensionCaseDto,
  CreatePensionEvidenceDto,
  CreatePensionSchemeDto,
  RejectPensionCaseDto,
  ReportPensionerDeathDto,
  ReviewPensionCaseDto,
  ReviewPensionDeathDto,
  ReviewPensionEvidenceDto,
} from './pension.dto';

@Injectable()
export class PensionsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PensionsService.name);
  private activationTimer?: NodeJS.Timeout;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    void this.activateDueSchedules();
    this.activationTimer = setInterval(() => void this.activateDueSchedules(), 60_000);
    this.activationTimer.unref();
  }

  onModuleDestroy() {
    if (this.activationTimer) clearInterval(this.activationTimer);
  }

  async findSchemes(user: AuthenticatedUser) {
    const scopedOrgIds = organizationIdsForPermission(user, 'pensions.read');
    if (scopedOrgIds === null) {
      return this.prisma.pensionScheme.findMany({ where: { isActive: true }, orderBy: [{ name: 'asc' }] });
    }
    const visibleOrgIds = await this.ancestorOrganizationIds(scopedOrgIds);
    return this.prisma.pensionScheme.findMany({
      where: { isActive: true, organizationId: { in: visibleOrgIds } },
      orderBy: [{ name: 'asc' }],
    });
  }

  async createScheme(dto: CreatePensionSchemeDto, user: AuthenticatedUser) {
    assertOrganizationPermission(user, dto.organizationId, 'pensions.manage');
    const organization = await this.prisma.organization.findUnique({ where: { id: dto.organizationId }, select: { id: true, status: true } });
    if (!organization) throw new NotFoundException('Organization not found');
    if (organization.status !== 'ACTIVE') throw new ConflictException('A pension scheme cannot be added to an inactive organization');
    try {
      return await this.prisma.pensionScheme.create({
        data: {
          organizationId: dto.organizationId,
          code: dto.code.trim().toUpperCase(),
          name: dto.name.trim(),
          schemeType: dto.schemeType,
          eligibilityPolicy: dto.eligibilityPolicy?.trim(),
          officialSource: dto.officialSource?.trim(),
          requiredEvidenceTypes: [...new Set(dto.requiredEvidenceTypes)],
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A scheme with this code already exists in the organization');
      }
      throw error;
    }
  }

  async findCases(organizationId: string | undefined, user: AuthenticatedUser) {
    await this.activateDueSchedules();
    const accessibleOrgIds = organizationIdsForPermission(user, 'pensions.read');
    if (organizationId) assertOrganizationPermission(user, organizationId, 'pensions.read');
    return this.prisma.pensionCase.findMany({
      where: {
        ...(organizationId ? { employment: { organizationId } } : accessibleOrgIds ? { employment: { organizationId: { in: accessibleOrgIds } } } : {}),
      },
      include: this.caseInclude(),
      orderBy: [{ updatedAt: 'desc' }],
      take: 200,
    });
  }

  async findCase(id: string, user: AuthenticatedUser) {
    await this.activateDueSchedules();
    return this.getAccessibleCase(id, user, 'pensions.read');
  }

  async createCase(dto: CreatePensionCaseDto, user: AuthenticatedUser) {
    const retirementDate = this.dateOnly(dto.retirementDate, 'retirementDate');
    const employment = await this.prisma.employment.findUnique({
      where: { id: dto.employmentId },
      select: { id: true, organizationId: true, startDate: true, status: true, employmentNumber: true },
    });
    if (!employment) throw new NotFoundException('Employment not found');
    assertOrganizationPermission(user, employment.organizationId, 'pensions.create');
    if (retirementDate < employment.startDate) throw new ConflictException('Retirement date cannot be before employment start date');
    const scheme = await this.prisma.pensionScheme.findUnique({ where: { id: dto.schemeId } });
    if (!scheme || !scheme.isActive) throw new NotFoundException('Active pension scheme not found');
    if (!(await this.schemeCoversOrganization(scheme.organizationId, employment.organizationId))) {
      throw new ConflictException('The selected scheme does not cover this employment organization');
    }
    try {
      const created = await this.prisma.pensionCase.create({
        data: {
          employmentId: employment.id,
          schemeId: scheme.id,
          retirementDate,
          qualifyingServiceYears: dto.qualifyingServiceYears == null ? undefined : new Prisma.Decimal(dto.qualifyingServiceYears.toFixed(2)),
          proposedMonthlyAmount: dto.proposedMonthlyAmount == null ? undefined : new Prisma.Decimal(dto.proposedMonthlyAmount.toFixed(2)),
          currency: this.currency(dto.currency ?? 'KES'),
          caseReference: dto.caseReference?.trim() || undefined,
          createdByUserId: user.id,
        },
      });
      await this.event(created.id, user.id, 'CASE_CREATED', null, created.status, retirementDate, 'Retirement pension case opened for review');
      return this.findCase(created.id, user);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('A pension case already exists for this employment and scheme');
      }
      throw error;
    }
  }

  async addEvidence(caseId: string, dto: CreatePensionEvidenceDto, user: AuthenticatedUser) {
    const pensionCase = await this.getAccessibleCase(caseId, user, 'pensions.create');
    const evidenceAddStatuses: PensionCaseStatus[] = [PensionCaseStatus.DRAFT, PensionCaseStatus.SUBMITTED, PensionCaseStatus.UNDER_REVIEW];
    if (!evidenceAddStatuses.includes(pensionCase.status)) {
      throw new ConflictException('Evidence can only be added while a retirement case is open for review');
    }
    return this.prisma.pensionEvidence.create({
      data: { pensionCaseId: caseId, evidenceType: dto.evidenceType, documentReference: dto.documentReference.trim() },
    });
  }

  async reviewEvidence(caseId: string, evidenceId: string, dto: ReviewPensionEvidenceDto, user: AuthenticatedUser) {
    await this.getAccessibleCase(caseId, user, 'pensions.review');
    const evidence = await this.prisma.pensionEvidence.findFirst({ where: { id: evidenceId, pensionCaseId: caseId } });
    if (!evidence) throw new NotFoundException('Evidence record not found');
    if (evidence.evidenceType === 'DEATH_CERTIFICATE') throw new ConflictException('Death certificates use the dedicated death-review process');
    if (evidence.status !== PensionEvidenceStatus.PENDING) throw new ConflictException('This evidence record has already been reviewed');
    return this.prisma.pensionEvidence.update({
      where: { id: evidence.id },
      data: { status: dto.decision, reviewNotes: dto.notes?.trim(), verifiedByUserId: user.id, verifiedAt: new Date() },
    });
  }

  async submitCase(caseId: string, user: AuthenticatedUser) {
    const pensionCase = await this.getAccessibleCase(caseId, user, 'pensions.create');
    if (pensionCase.status !== PensionCaseStatus.DRAFT) throw new ConflictException('Only a draft pension case can be submitted');
    const evidence = await this.prisma.pensionEvidence.findMany({ where: { pensionCaseId: caseId }, select: { evidenceType: true } });
    const present = new Set(evidence.map((item) => item.evidenceType));
    for (const type of ['RETIREMENT_NOTICE', 'SERVICE_RECORD', ...pensionCase.scheme.requiredEvidenceTypes]) {
      if (!present.has(type)) throw new ConflictException(`Add the required ${type.replaceAll('_', ' ').toLowerCase()} evidence reference before submission`);
    }
    return this.changeCaseStatus(caseId, user, PensionCaseStatus.DRAFT, PensionCaseStatus.SUBMITTED, 'CASE_SUBMITTED', 'pensions.create', { submittedAt: new Date() });
  }

  async beginReview(caseId: string, dto: ReviewPensionCaseDto, user: AuthenticatedUser) {
    const pensionCase = await this.getAccessibleCase(caseId, user, 'pensions.review');
    if (pensionCase.status !== PensionCaseStatus.SUBMITTED) throw new ConflictException('Only a submitted pension case can enter review');
    return this.changeCaseStatus(caseId, user, PensionCaseStatus.SUBMITTED, PensionCaseStatus.UNDER_REVIEW, 'REVIEW_STARTED', 'pensions.review', { reviewedAt: new Date(), reviewedBy: { connect: { id: user.id } }, reviewNotes: dto.notes?.trim() });
  }

  async approveCase(caseId: string, dto: ApprovePensionCaseDto, user: AuthenticatedUser) {
    const pensionCase = await this.getAccessibleCase(caseId, user, 'pensions.approve');
    if (pensionCase.status !== PensionCaseStatus.UNDER_REVIEW) throw new ConflictException('Only a case under review can be approved');
    if (dto.approvedMonthlyAmount <= 0) throw new BadRequestException('Approved monthly pension amount must be greater than zero');
    const evidence = await this.prisma.pensionEvidence.findMany({ where: { pensionCaseId: caseId, status: PensionEvidenceStatus.VERIFIED }, select: { evidenceType: true } });
    const verified = new Set(evidence.map((item) => item.evidenceType));
    for (const type of ['RETIREMENT_NOTICE', 'SERVICE_RECORD', ...pensionCase.scheme.requiredEvidenceTypes]) {
      if (!verified.has(type)) throw new ConflictException(`The ${type.replaceAll('_', ' ').toLowerCase()} evidence must be verified before approval`);
    }
    const today = this.today();
    const isRetirementDateReached = pensionCase.retirementDate <= today;
    const employment = await this.prisma.employment.findUnique({ where: { id: pensionCase.employmentId }, select: { status: true } });
    if (isRetirementDateReached && employment?.status !== EmploymentStatus.RETIRED) {
      throw new ConflictException('The employment must be recorded as RETIRED before pension payments can start');
    }
    if (!isRetirementDateReached && employment?.status !== EmploymentStatus.ACTIVE) {
      throw new ConflictException('A future retirement schedule requires the employment to remain active until its retirement date');
    }
    const amount = new Prisma.Decimal(dto.approvedMonthlyAmount.toFixed(2));
    const currency = this.currency(dto.currency ?? pensionCase.currency);
    const status = isRetirementDateReached ? PensionScheduleStatus.ACTIVE : PensionScheduleStatus.SCHEDULED;
    const approvedAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.pensionCase.update({
        where: { id: caseId },
        data: { status: PensionCaseStatus.APPROVED, approvedMonthlyAmount: amount, currency, approvedAt, approvedByUserId: user.id, reviewNotes: dto.approvalReference.trim() },
      });
      await tx.pensionPaymentSchedule.create({
        data: { pensionCaseId: caseId, monthlyAmount: amount, currency, effectiveFrom: pensionCase.retirementDate, status, activatedAt: isRetirementDateReached ? approvedAt : null },
      });
      await tx.pensionCaseEvent.create({
        data: { pensionCaseId: caseId, actorUserId: user.id, action: 'CASE_APPROVED', fromStatus: PensionCaseStatus.UNDER_REVIEW, toStatus: PensionCaseStatus.APPROVED, effectiveDate: pensionCase.retirementDate, note: `Approved against reference ${dto.approvalReference.trim()}; payment schedule ${status.toLowerCase()}` },
      });
    });
    return this.findCase(caseId, user);
  }

  async rejectCase(caseId: string, dto: RejectPensionCaseDto, user: AuthenticatedUser) {
    const pensionCase = await this.getAccessibleCase(caseId, user, 'pensions.approve');
    if (pensionCase.status !== PensionCaseStatus.UNDER_REVIEW) throw new ConflictException('Only a case under review can be rejected');
    return this.changeCaseStatus(caseId, user, PensionCaseStatus.UNDER_REVIEW, PensionCaseStatus.REJECTED, 'CASE_REJECTED', 'pensions.approve', { reviewNotes: dto.reason.trim(), reviewedAt: new Date(), reviewedBy: { connect: { id: user.id } } });
  }

  async reportDeath(caseId: string, dto: ReportPensionerDeathDto, user: AuthenticatedUser) {
    const pensionCase = await this.getAccessibleCase(caseId, user, 'pensions.review');
    if (pensionCase.status !== PensionCaseStatus.APPROVED || !pensionCase.schedule) throw new ConflictException('A death report can only be opened for an approved pension case');
    const deathDate = this.dateOnly(dto.deathEffectiveDate, 'deathEffectiveDate');
    if (deathDate < pensionCase.schedule.effectiveFrom || deathDate > this.today()) {
      throw new ConflictException('The death date must be on or after pension commencement and cannot be in the future');
    }
    const reportedAt = new Date();
    await this.prisma.$transaction(async (tx) => {
      await tx.pensionEvidence.create({ data: { pensionCaseId: caseId, evidenceType: 'DEATH_CERTIFICATE', documentReference: dto.deathCertificateReference.trim() } });
      await tx.pensionCase.update({ where: { id: caseId }, data: { status: PensionCaseStatus.DEATH_REPORTED, deathReportedAt: reportedAt, deathEffectiveDate: deathDate, deathCertificateRef: dto.deathCertificateReference.trim(), deathReviewNotes: dto.notes?.trim(), survivorClaimStatus: 'PENDING_REVIEW' } });
      await tx.pensionPaymentSchedule.update({ where: { pensionCaseId: caseId }, data: { status: PensionScheduleStatus.SUSPENDED } });
      await tx.pensionCaseEvent.create({ data: { pensionCaseId: caseId, actorUserId: user.id, action: 'DEATH_REPORTED', fromStatus: PensionCaseStatus.APPROVED, toStatus: PensionCaseStatus.DEATH_REPORTED, effectiveDate: deathDate, note: 'Payment schedule suspended pending independent death certificate verification' } });
    });
    return this.findCase(caseId, user);
  }

  async reviewDeath(caseId: string, dto: ReviewPensionDeathDto, user: AuthenticatedUser) {
    const pensionCase = await this.getAccessibleCase(caseId, user, 'pensions.death.review');
    if (pensionCase.status !== PensionCaseStatus.DEATH_REPORTED || !pensionCase.schedule) throw new ConflictException('This pension case has no death report awaiting review');
    const evidence = await this.prisma.pensionEvidence.findFirst({ where: { pensionCaseId: caseId, evidenceType: 'DEATH_CERTIFICATE', status: PensionEvidenceStatus.PENDING }, orderBy: { createdAt: 'desc' } });
    if (!evidence) throw new ConflictException('A pending death certificate reference was not found');
    const reviewedAt = new Date();
    const verified = dto.decision === 'VERIFIED';
    const nextStatus = verified ? PensionCaseStatus.CLOSED : PensionCaseStatus.APPROVED;
    const scheduleStatus = verified ? PensionScheduleStatus.STOPPED : pensionCase.schedule.effectiveFrom <= this.today() ? PensionScheduleStatus.ACTIVE : PensionScheduleStatus.SCHEDULED;
    await this.prisma.$transaction(async (tx) => {
      await tx.pensionEvidence.update({ where: { id: evidence.id }, data: { status: dto.decision, reviewNotes: dto.notes.trim(), verifiedByUserId: user.id, verifiedAt: reviewedAt } });
      await tx.pensionCase.update({ where: { id: caseId }, data: { status: nextStatus, deathReviewedAt: reviewedAt, deathReviewedByUserId: user.id, deathReviewNotes: dto.notes.trim(), survivorClaimStatus: verified ? 'REVIEW_REQUIRED' : 'NOT_ASSESSED' } });
      await tx.pensionPaymentSchedule.update({ where: { pensionCaseId: caseId }, data: verified
        ? { status: PensionScheduleStatus.STOPPED, effectiveTo: pensionCase.deathEffectiveDate, stoppedAt: reviewedAt }
        : { status: scheduleStatus, effectiveTo: null, stoppedAt: null, ...(scheduleStatus === PensionScheduleStatus.ACTIVE ? { activatedAt: reviewedAt } : {}) } });
      await tx.pensionCaseEvent.create({ data: { pensionCaseId: caseId, actorUserId: user.id, action: verified ? 'DEATH_VERIFIED_PENSION_STOPPED' : 'DEATH_REPORT_REJECTED_SCHEDULE_RESTORED', fromStatus: PensionCaseStatus.DEATH_REPORTED, toStatus: nextStatus, effectiveDate: pensionCase.deathEffectiveDate ?? undefined, note: dto.notes.trim() } });
    });
    return this.findCase(caseId, user);
  }

  private async changeCaseStatus(caseId: string, user: AuthenticatedUser, from: PensionCaseStatus, to: PensionCaseStatus, action: string, permission: string, data: Prisma.PensionCaseUpdateInput) {
    const pensionCase = await this.getAccessibleCase(caseId, user, permission);
    if (pensionCase.status !== from) throw new ConflictException(`Pension case must be ${from.toLowerCase()} for this action`);
    await this.prisma.$transaction(async (tx) => {
      await tx.pensionCase.update({ where: { id: caseId }, data: { ...data, status: to } });
      await tx.pensionCaseEvent.create({ data: { pensionCaseId: caseId, actorUserId: user.id, action, fromStatus: from, toStatus: to, note: typeof data.reviewNotes === 'string' ? data.reviewNotes : undefined } });
    });
    return this.findCase(caseId, user);
  }

  private async event(caseId: string, actorUserId: string, action: string, fromStatus: PensionCaseStatus | null, toStatus: PensionCaseStatus | null, effectiveDate?: Date, note?: string) {
    await this.prisma.pensionCaseEvent.create({ data: { pensionCaseId: caseId, actorUserId, action, fromStatus: fromStatus ?? undefined, toStatus: toStatus ?? undefined, effectiveDate, note } });
  }

  private async getAccessibleCase(id: string, user: AuthenticatedUser, permission: string) {
    const pensionCase = await this.prisma.pensionCase.findUnique({ where: { id }, include: this.caseInclude() });
    if (!pensionCase) throw new NotFoundException('Pension case not found');
    assertOrganizationPermission(user, pensionCase.employment.organizationId, permission);
    return pensionCase;
  }

  private caseInclude(): Prisma.PensionCaseInclude {
    return {
      scheme: { select: { id: true, organizationId: true, code: true, name: true, schemeType: true, eligibilityPolicy: true, officialSource: true, requiredEvidenceTypes: true } },
      employment: { select: { id: true, employmentNumber: true, employmentType: true, status: true, startDate: true, endDate: true, organizationId: true, organization: { select: { id: true, code: true, name: true } }, person: { select: { personNumber: true, firstName: true, middleName: true, lastName: true } } } },
      schedule: true,
      evidence: { orderBy: { createdAt: 'asc' } },
      events: { orderBy: { createdAt: 'asc' }, include: { actor: { select: { fullName: true } } } },
    };
  }

  private async ancestorOrganizationIds(organizationIds: string[]) {
    if (!organizationIds.length) return [];
    const organizations = await this.prisma.organization.findMany({ select: { id: true, parentId: true } });
    const parentById = new Map(organizations.map(({ id, parentId }) => [id, parentId]));
    const ancestors = new Set<string>();
    for (const organizationId of organizationIds) {
      let current: string | null | undefined = organizationId;
      while (current && !ancestors.has(current)) {
        ancestors.add(current);
        current = parentById.get(current);
      }
    }
    return [...ancestors];
  }

  private async schemeCoversOrganization(schemeOrganizationId: string, employmentOrganizationId: string) {
    let current: string | null = employmentOrganizationId;
    while (current) {
      if (current === schemeOrganizationId) return true;
      const organization: { parentId: string | null } | null = await this.prisma.organization.findUnique({ where: { id: current }, select: { parentId: true } });
      current = organization?.parentId ?? null;
    }
    return false;
  }

  private async activateDueSchedules() {
    const today = this.today();
    try {
      const dueSchedules = await this.prisma.pensionPaymentSchedule.findMany({
        where: {
          status: PensionScheduleStatus.SCHEDULED,
          effectiveFrom: { lte: today },
          pensionCase: { status: PensionCaseStatus.APPROVED, employment: { status: EmploymentStatus.RETIRED } },
        },
        select: { id: true, pensionCaseId: true, effectiveFrom: true },
      });
      for (const schedule of dueSchedules) {
        await this.prisma.$transaction(async (tx) => {
          const activated = await tx.pensionPaymentSchedule.updateMany({
            where: { id: schedule.id, status: PensionScheduleStatus.SCHEDULED },
            data: { status: PensionScheduleStatus.ACTIVE, activatedAt: new Date() },
          });
          if (activated.count) {
            await tx.pensionCaseEvent.create({
              data: {
                pensionCaseId: schedule.pensionCaseId,
                action: 'SCHEDULE_ACTIVATED_AUTOMATICALLY',
                fromStatus: PensionScheduleStatus.SCHEDULED,
                toStatus: PensionScheduleStatus.ACTIVE,
                effectiveDate: schedule.effectiveFrom,
                note: 'Retirement date reached and employment status verified as retired',
              },
            });
          }
        });
      }
    } catch (error) {
      this.logger.error('Could not activate due pension schedules', error);
    }
  }

  private currency(value: string) {
    const currency = value.trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(currency)) throw new BadRequestException('currency must be a three-letter code');
    return currency;
  }

  private today() {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    return today;
  }

  private dateOnly(value: string, field: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new BadRequestException(`${field} must use YYYY-MM-DD`);
    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new BadRequestException(`${field} is not a valid date`);
    return date;
  }
}
