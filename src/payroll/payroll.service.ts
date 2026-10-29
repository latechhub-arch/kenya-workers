import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EmploymentStatus, PayslipStatus, PayComponentType, Prisma } from '@prisma/client';
import { assertOrganizationPermission } from '../auth/organization-access';
import { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { ClosePayComponentDto } from './close-pay-component.dto';
import { CreatePayComponentDto } from './create-pay-component.dto';
import { CreatePayslipDto } from './create-payslip.dto';
import { SaveEmployeeBudgetDto } from './save-employee-budget.dto';

@Injectable()
export class PayrollService {
  constructor(private readonly prisma: PrismaService) {}

  async getMyBudget(user: AuthenticatedUser) {
    if (!user.personId) {
      throw new ForbiddenException('This account is not linked to an employee record');
    }
    const [profile, latestPayslip] = await Promise.all([
      this.prisma.employeeBudgetProfile.findUnique({
        where: { userId: user.id },
        include: { items: { orderBy: [{ category: 'asc' }, { title: 'asc' }] } },
      }),
      this.prisma.payslip.findFirst({
        where: { status: PayslipStatus.ISSUED, employment: { personId: user.personId } },
        orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }, { version: 'desc' }],
        select: { periodYear: true, periodMonth: true, currency: true, netPay: true, isProvisional: true },
      }),
    ]);
    const income = latestPayslip
      ? {
          amount: latestPayslip.netPay.toNumber(),
          currency: latestPayslip.currency,
          source: 'PAYSLIP',
          isProvisional: latestPayslip.isProvisional,
          periodYear: latestPayslip.periodYear,
          periodMonth: latestPayslip.periodMonth,
        }
      : profile?.monthlyTakeHome
        ? {
            amount: profile.monthlyTakeHome.toNumber(),
            currency: 'KES',
            source: 'SELF_REPORTED',
            isProvisional: false,
            periodYear: null,
            periodMonth: null,
          }
        : { amount: null, currency: 'KES', source: 'NOT_SET', isProvisional: false, periodYear: null, periodMonth: null };
    const items = (profile?.items || []).map((item) => ({
      id: item.id,
      category: item.category,
      title: item.title,
      monthlyAmount: item.monthlyAmount.toNumber(),
      outstandingBalance: item.outstandingBalance?.toNumber() ?? null,
    }));
    const amount = income.amount;
    const totalOutgoings = items.reduce((sum, item) => sum + item.monthlyAmount, 0);
    const monthlyDebtPayments = items
      .filter((item) => item.category === 'DEBT')
      .reduce((sum, item) => sum + item.monthlyAmount, 0);
    const remaining = amount === null ? null : amount - totalOutgoings;
    const advice: string[] = [];
    if (amount === null) {
      advice.push('No finalized payslip or take-home amount is available. Enter your usual monthly take-home pay to see a budget overview.');
    } else {
      if (income.isProvisional) {
        advice.push('The latest payslip uses provisional pay figures. Treat this overview as an estimate until approved payroll data is available.');
      }
      if (remaining !== null && remaining < 0) {
        advice.push(`Your entered monthly commitments exceed take-home pay by ${income.currency} ${Math.abs(remaining).toFixed(2)}. Recheck each amount and whether it is monthly; then review flexible costs while protecting essential needs and required loan payments.`);
      } else if (remaining !== null && remaining <= amount * 0.1) {
        advice.push(`About ${income.currency} ${remaining.toFixed(2)} remains after the items you entered. Consider whether the plan leaves enough for irregular costs; if possible, build a small reserve that fits your situation.`);
      } else if (remaining !== null && remaining > 0) {
        advice.push(`About ${income.currency} ${remaining.toFixed(2)} is not assigned in this plan. You can allocate some to upcoming irregular bills, savings, or keep it as a buffer.`);
      }
      const debtShare = amount > 0 ? (monthlyDebtPayments / amount) * 100 : 0;
      const debtCount = items.filter((item) => item.category === 'DEBT' && item.monthlyAmount > 0).length;
      if (debtCount > 0) {
        advice.push(`You listed ${debtCount} loan or debt payment${debtCount === 1 ? '' : 's'}, totaling ${income.currency} ${monthlyDebtPayments.toFixed(2)} per month (${debtShare.toFixed(1)}% of take-home pay). This is a planning signal, not an official limit. Check each balance, interest, fees, and end date; contact the lender before changing or missing a required payment.`);
      }
      if (!items.some((item) => item.category === 'SAVINGS' && item.monthlyAmount > 0)) {
        advice.push('No regular saving is included. If your essential costs and required payments allow, even a small amount you can sustain may help with unexpected expenses.');
      }
      for (const category of ['HOUSING', 'FOOD'] as const) {
        const categoryTotal = items.filter((item) => item.category === category).reduce((sum, item) => sum + item.monthlyAmount, 0);
        if (categoryTotal > 0 && amount > 0) {
          const label = category === 'HOUSING' ? 'Housing' : 'Food';
          advice.push(`${label} entries total ${income.currency} ${categoryTotal.toFixed(2)} (${((categoryTotal / amount) * 100).toFixed(1)}% of take-home pay). Use this as a visibility check and adjust the plan to your household’s actual needs.`);
        }
      }
    }
    return {
      income,
      manualMonthlyTakeHome: profile?.monthlyTakeHome?.toNumber() ?? null,
      items,
      analysis: { totalOutgoings, monthlyDebtPayments, remaining, advice },
      privacy: 'Your budget entries are private to your employee account and are not available in staff or payroll administration screens.',
      updatedAt: profile?.updatedAt ?? null,
    };
  }

  async saveMyBudget(dto: SaveEmployeeBudgetDto, user: AuthenticatedUser) {
    if (!user.personId) {
      throw new ForbiddenException('This account is not linked to an employee record');
    }
    const items = dto.items.map((item) => ({
      category: item.category,
      title: item.title.trim(),
      monthlyAmount: new Prisma.Decimal(item.monthlyAmount.toFixed(2)),
      outstandingBalance: item.outstandingBalance == null
        ? undefined
        : new Prisma.Decimal(item.outstandingBalance.toFixed(2)),
    }));
    if (items.some((item) => !item.title)) {
      throw new BadRequestException('Every budget item needs a label');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.employeeBudgetProfile.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          monthlyTakeHome: dto.monthlyTakeHome == null
            ? null
            : new Prisma.Decimal(dto.monthlyTakeHome.toFixed(2)),
        },
        update: {
          ...(dto.monthlyTakeHome === undefined
            ? {}
            : { monthlyTakeHome: dto.monthlyTakeHome === null ? null : new Prisma.Decimal(dto.monthlyTakeHome.toFixed(2)) }),
        },
      });
      await tx.employeeBudgetItem.deleteMany({ where: { userId: user.id } });
      if (items.length) {
        await tx.employeeBudgetItem.createMany({ data: items.map((item) => ({ ...item, userId: user.id })) });
      }
    });
    return this.getMyBudget(user);
  }

  async findMyPayslips(year: string | undefined, user: AuthenticatedUser) {
    if (!user.personId) {
      throw new ForbiddenException('This account is not linked to an employee record');
    }
    const periodYear = year === undefined ? undefined : Number(year);
    if (periodYear !== undefined && (!Number.isInteger(periodYear) || periodYear < 2000 || periodYear > 2200)) {
      throw new BadRequestException('year must be a four-digit year');
    }
    return this.prisma.payslip.findMany({
      where: {
        status: PayslipStatus.ISSUED,
        employment: { personId: user.personId },
        ...(periodYear ? { periodYear } : {}),
      },
      orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }],
      include: { lines: { orderBy: { displayOrder: 'asc' } } },
    });
  }

  async findComponents(employmentId: string, user: AuthenticatedUser) {
    const employment = await this.getEmployment(employmentId);
    assertOrganizationPermission(user, employment.organizationId, 'payroll.read');
    return this.prisma.employmentPayComponent.findMany({
      where: { employmentId },
      orderBy: [{ code: 'asc' }, { effectiveFrom: 'asc' }],
    });
  }

  async createComponent(
    employmentId: string,
    dto: CreatePayComponentDto,
    user: AuthenticatedUser,
  ) {
    const effectiveFrom = this.dateOnly(dto.effectiveFrom, 'effectiveFrom');
    const amount = this.money(dto.amount, 'amount');
    const balance = dto.balance === undefined ? undefined : this.money(dto.balance, 'balance');

    return this.prisma.$transaction(async (tx) => {
      const employment = await tx.employment.findUnique({
        where: { id: employmentId },
        select: { id: true, organizationId: true, startDate: true, endDate: true },
      });
      if (!employment) throw new NotFoundException('Employment not found');
      assertOrganizationPermission(user, employment.organizationId, 'payroll.manage');
      if (effectiveFrom < employment.startDate || (employment.endDate && effectiveFrom > employment.endDate)) {
        throw new ConflictException('Pay component date must fall within the employment dates');
      }

      const previous = await tx.employmentPayComponent.findFirst({
        where: { employmentId, code: dto.code },
        orderBy: { effectiveFrom: 'desc' },
      });
      if (previous && effectiveFrom <= previous.effectiveFrom) {
        throw new ConflictException('A pay component change must start after its latest recorded version');
      }
      const previousDay = new Date(effectiveFrom);
      previousDay.setUTCDate(previousDay.getUTCDate() - 1);
      if (previous && (!previous.effectiveTo || previous.effectiveTo >= effectiveFrom)) {
        await tx.employmentPayComponent.update({
          where: { id: previous.id },
          data: { effectiveTo: previousDay },
        });
      }

      return tx.employmentPayComponent.create({
        data: {
          employmentId,
          code: dto.code,
          title: dto.title,
          type: dto.type,
          frequency: dto.frequency,
          currency: dto.currency ?? 'KES',
          amount,
          balance,
          effectiveFrom,
          note: dto.note,
        },
      });
    }, { isolationLevel: 'Serializable' });
  }

  async closeComponent(id: string, dto: ClosePayComponentDto, user: AuthenticatedUser) {
    const effectiveTo = this.dateOnly(dto.effectiveTo, 'effectiveTo');
    const component = await this.prisma.employmentPayComponent.findUnique({
      where: { id },
      include: { employment: { select: { organizationId: true } } },
    });
    if (!component) throw new NotFoundException('Pay component not found');
    assertOrganizationPermission(user, component.employment.organizationId, 'payroll.manage');
    if (component.effectiveTo) throw new ConflictException('Pay component is already closed');
    if (effectiveTo < component.effectiveFrom) {
      throw new ConflictException('A pay component cannot end before its effective date');
    }
    return this.prisma.employmentPayComponent.update({
      where: { id },
      data: { effectiveTo },
    });
  }

  async findEmploymentPayslips(employmentId: string, user: AuthenticatedUser) {
    const employment = await this.getEmployment(employmentId);
    assertOrganizationPermission(user, employment.organizationId, 'payroll.read');
    return this.prisma.payslip.findMany({
      where: { employmentId },
      orderBy: [{ periodYear: 'desc' }, { periodMonth: 'desc' }, { version: 'desc' }],
      include: { lines: { orderBy: { displayOrder: 'asc' } } },
    });
  }

  async createPayslip(employmentId: string, dto: CreatePayslipDto, user: AuthenticatedUser) {
    return this.prisma.$transaction(async (tx) => {
      const employment = await tx.employment.findUnique({
        where: { id: employmentId },
        select: { id: true, organizationId: true, startDate: true, endDate: true },
      });
      if (!employment) throw new NotFoundException('Employment not found');
      assertOrganizationPermission(user, employment.organizationId, 'payroll.manage');

      const periodStart = new Date(Date.UTC(dto.periodYear, dto.periodMonth - 1, 1));
      const periodEnd = new Date(Date.UTC(dto.periodYear, dto.periodMonth, 0));
      if (employment.startDate > periodEnd || (employment.endDate && employment.endDate < periodStart)) {
        throw new ConflictException('The employment does not overlap the selected payslip month');
      }
      const snapshotDate = employment.endDate && employment.endDate < periodEnd
        ? employment.endDate
        : periodEnd;
      const assignment = await tx.employmentCompensationAssignment.findFirst({
        where: {
          employmentId,
          effectiveFrom: { lte: snapshotDate },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: snapshotDate } }],
        },
        orderBy: { effectiveFrom: 'desc' },
        include: {
          compensationStep: {
            include: { jobLevel: { select: { title: true } }, compensationScale: { select: { currency: true, isProvisional: true } } },
          },
        },
      });
      if (!assignment) {
        throw new ConflictException('A compensation step must be assigned for the payslip period');
      }
      const currency = assignment.compensationStep.compensationScale.currency;
      const components = await tx.employmentPayComponent.findMany({
        where: {
          employmentId,
          effectiveFrom: { lte: snapshotDate },
          OR: [{ effectiveTo: null }, { effectiveTo: { gte: snapshotDate } }],
        },
        orderBy: [{ type: 'asc' }, { code: 'asc' }],
      });
      const includedComponents = components.filter((component) =>
        component.frequency !== 'ONE_OFF' ||
        (component.effectiveFrom >= periodStart && component.effectiveFrom <= periodEnd),
      );
      if (includedComponents.some((component) => component.currency !== currency)) {
        throw new ConflictException('All payslip components must use the compensation scale currency');
      }
      const lines = [
        {
          code: 'BASIC_PAY',
          title: assignment.compensationStep.compensationScale.isProvisional
            ? `Basic pay — ${assignment.compensationStep.jobLevel.title} (provisional)`
            : `Basic pay — ${assignment.compensationStep.jobLevel.title}`,
          type: PayComponentType.EARNING,
          amount: assignment.compensationStep.basicSalary,
          balance: undefined,
          displayOrder: 0,
        },
        ...includedComponents.map((component, index) => ({
          code: component.code,
          title: component.title,
          type: component.type,
          amount: component.amount,
          balance: component.balance ?? undefined,
          displayOrder: index + 1,
        })),
      ];
      const cents = (value: Prisma.Decimal) => Math.round(value.toNumber() * 100);
      const earningsCents = lines.filter((line) => line.type === PayComponentType.EARNING).reduce((sum, line) => sum + cents(line.amount), 0);
      const deductionsCents = lines.filter((line) => line.type === PayComponentType.DEDUCTION).reduce((sum, line) => sum + cents(line.amount), 0);

      const previous = await tx.payslip.findFirst({
        where: { employmentId, periodYear: dto.periodYear, periodMonth: dto.periodMonth },
        orderBy: { version: 'desc' },
        select: { id: true, version: true, status: true },
      });
      if (previous?.status === PayslipStatus.ISSUED && !dto.correctionReason?.trim()) {
        throw new ConflictException('A correction reason is required to replace an issued payslip');
      }
      if (previous?.status === PayslipStatus.ISSUED) {
        await tx.payslip.update({ where: { id: previous.id }, data: { status: PayslipStatus.SUPERSEDED } });
      }

      return tx.payslip.create({
        data: {
          employmentId,
          periodYear: dto.periodYear,
          periodMonth: dto.periodMonth,
          version: (previous?.version ?? 0) + 1,
          currency,
          status: PayslipStatus.ISSUED,
          isProvisional: assignment.compensationStep.compensationScale.isProvisional,
          earningsTotal: new Prisma.Decimal(earningsCents).div(100),
          deductionsTotal: new Prisma.Decimal(deductionsCents).div(100),
          netPay: new Prisma.Decimal(earningsCents - deductionsCents).div(100),
          correctionReason: dto.correctionReason?.trim() || undefined,
          lines: { create: lines },
        },
        include: { lines: { orderBy: { displayOrder: 'asc' } } },
      });
    }, { isolationLevel: 'Serializable' });
  }

  private async getEmployment(id: string) {
    const employment = await this.prisma.employment.findUnique({
      where: { id },
      select: { id: true, organizationId: true, startDate: true, endDate: true },
    });
    if (!employment) throw new NotFoundException('Employment not found');
    return employment;
  }

  private dateOnly(value: string, fieldName: string) {
    const match = /^\d{4}-\d{2}-\d{2}$/.exec(value);
    if (!match) throw new BadRequestException(`${fieldName} must use YYYY-MM-DD`);
    const date = new Date(`${value}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
      throw new BadRequestException(`${fieldName} is not a valid calendar date`);
    }
    return date;
  }

  private money(value: number, fieldName: string) {
    if (!Number.isFinite(value) || value < 0) {
      throw new BadRequestException(`${fieldName} must be a non-negative amount`);
    }
    return new Prisma.Decimal(value.toFixed(2));
  }
}
