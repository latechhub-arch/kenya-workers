import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  assertOrganizationPermission,
  organizationIdsForPermission,
} from '../auth/organization-access';
import { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { CompensationQueryDto } from './compensation-query.dto';
import { CloseCompensationScaleDto } from './close-compensation-scale.dto';
import { CreateCompensationScaleDto } from './create-compensation-scale.dto';

@Injectable()
export class CompensationService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: CompensationQueryDto, user: AuthenticatedUser) {
    const visibleOrganizationIds =
      await this.visibleFrameworkOrganizations(user);

    if (query.frameworkId) {
      const framework = await this.prisma.jobFramework.findUnique({
        where: { id: query.frameworkId },
        select: { organizationId: true },
      });
      if (!framework) throw new NotFoundException('Job framework not found');
      if (
        visibleOrganizationIds &&
        !visibleOrganizationIds.includes(framework.organizationId)
      ) {
        throw new ForbiddenException(
          'You do not have access to this job framework',
        );
      }
    }

    return this.prisma.compensationScale.findMany({
      where: {
        ...(query.frameworkId ? { frameworkId: query.frameworkId } : {}),
        ...(visibleOrganizationIds
          ? { framework: { organizationId: { in: visibleOrganizationIds } } }
          : {}),
      },
      orderBy: [
        { framework: { organization: { name: 'asc' } } },
        { effectiveFrom: 'desc' },
        { code: 'asc' },
      ],
      include: {
        framework: {
          include: {
            organization: { select: { id: true, code: true, name: true } },
          },
        },
        steps: {
          orderBy: [{ jobLevel: { levelOrder: 'asc' } }, { stepNumber: 'asc' }],
          include: {
            jobLevel: {
              select: { id: true, code: true, title: true, levelOrder: true },
            },
          },
        },
      },
    });
  }

  async create(dto: CreateCompensationScaleDto, user: AuthenticatedUser) {
    const framework = await this.prisma.jobFramework.findUnique({
      where: { id: dto.frameworkId },
      select: {
        id: true,
        organizationId: true,
        organization: { select: { status: true } },
      },
    });
    if (!framework) throw new NotFoundException('Job framework not found');
    if (framework.organization.status !== 'ACTIVE') {
      throw new ConflictException(
        'Compensation framework organization must be active',
      );
    }
    assertOrganizationPermission(
      user,
      framework.organizationId,
      'compensation.create',
    );

    const effectiveFrom = this.dateOnly(dto.effectiveFrom, 'effectiveFrom');
    const effectiveTo = dto.effectiveTo
      ? this.dateOnly(dto.effectiveTo, 'effectiveTo')
      : undefined;
    if (effectiveTo && effectiveTo < effectiveFrom) {
      throw new BadRequestException(
        'effectiveTo cannot be earlier than effectiveFrom',
      );
    }

    const keys = new Set<string>();
    for (const step of dto.steps) {
      const key = `${step.jobLevelId}:${step.stepNumber}`;
      if (keys.has(key)) {
        throw new ConflictException(
          'A job level cannot repeat the same step number',
        );
      }
      keys.add(key);
    }

    const jobLevelIds = [
      ...new Set(dto.steps.map(({ jobLevelId }) => jobLevelId)),
    ];
    const levels = await this.prisma.jobLevel.findMany({
      where: { id: { in: jobLevelIds }, frameworkId: dto.frameworkId },
      select: { id: true },
    });
    if (levels.length !== jobLevelIds.length) {
      throw new BadRequestException(
        'Every compensation step must reference a level in this framework',
      );
    }

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const overlappingScale = await tx.compensationScale.findFirst({
            where: {
              frameworkId: dto.frameworkId,
              ...(effectiveTo ? { effectiveFrom: { lte: effectiveTo } } : {}),
              OR: [
                { effectiveTo: null },
                { effectiveTo: { gte: effectiveFrom } },
              ],
            },
            select: { id: true },
          });
          if (overlappingScale) {
            throw new ConflictException(
              'Compensation scale dates overlap another scale in this framework',
            );
          }

          return tx.compensationScale.create({
            data: {
              frameworkId: dto.frameworkId,
              code: dto.code,
              name: dto.name,
              currency: dto.currency,
              effectiveFrom,
              effectiveTo,
              isProvisional: dto.isProvisional,
              source: dto.source,
              steps: {
                create: dto.steps.map((step) => ({
                  jobLevelId: step.jobLevelId,
                  stepNumber: step.stepNumber,
                  basicSalary: new Prisma.Decimal(String(step.basicSalary)),
                })),
              },
            },
            include: {
              framework: {
                include: {
                  organization: {
                    select: { id: true, code: true, name: true },
                  },
                },
              },
              steps: {
                orderBy: [
                  { jobLevel: { levelOrder: 'asc' } },
                  { stepNumber: 'asc' },
                ],
                include: {
                  jobLevel: {
                    select: {
                      id: true,
                      code: true,
                      title: true,
                      levelOrder: true,
                    },
                  },
                },
              },
            },
          });
        },
        { isolationLevel: 'Serializable' },
      );
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new ConflictException(
          'Compensation scale code or step already exists',
        );
      }
      if (error?.code === 'P2034') {
        throw new ConflictException(
          'Compensation scales changed at the same time; refresh and retry',
        );
      }
      throw error;
    }
  }

  async close(
    id: string,
    dto: CloseCompensationScaleDto,
    user: AuthenticatedUser,
  ) {
    const effectiveTo = this.dateOnly(dto.effectiveTo, 'effectiveTo');
    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const scale = await tx.compensationScale.findUnique({
            where: { id },
            select: {
              id: true,
              frameworkId: true,
              effectiveFrom: true,
              effectiveTo: true,
              framework: { select: { organizationId: true } },
            },
          });
          if (!scale)
            throw new NotFoundException('Compensation scale not found');
          assertOrganizationPermission(
            user,
            scale.framework.organizationId,
            'compensation.update',
          );
          if (effectiveTo < scale.effectiveFrom) {
            throw new BadRequestException(
              'effectiveTo cannot be earlier than effectiveFrom',
            );
          }
          if (scale.effectiveTo && effectiveTo > scale.effectiveTo) {
            throw new ConflictException(
              'A closed compensation scale cannot be extended',
            );
          }

          const overlappingScale = await tx.compensationScale.findFirst({
            where: {
              frameworkId: scale.frameworkId,
              id: { not: id },
              effectiveFrom: { lte: effectiveTo },
              OR: [
                { effectiveTo: null },
                { effectiveTo: { gte: scale.effectiveFrom } },
              ],
            },
            select: { id: true },
          });
          if (overlappingScale) {
            throw new ConflictException(
              'Closing this scale would overlap another scale in the framework',
            );
          }

          const assignmentsStartingLater =
            await tx.employmentCompensationAssignment.findFirst({
              where: {
                compensationStep: { compensationScaleId: id },
                effectiveFrom: { gt: effectiveTo },
              },
              select: { id: true },
            });
          if (assignmentsStartingLater) {
            throw new ConflictException(
              'A compensation assignment starts after this scale close date',
            );
          }

          await tx.employmentCompensationAssignment.updateMany({
            where: {
              compensationStep: { compensationScaleId: id },
              effectiveFrom: { lte: effectiveTo },
              OR: [{ effectiveTo: null }, { effectiveTo: { gt: effectiveTo } }],
            },
            data: { effectiveTo },
          });

          return tx.compensationScale.update({
            where: { id },
            data: { effectiveTo },
            include: {
              framework: {
                include: {
                  organization: {
                    select: { id: true, code: true, name: true },
                  },
                },
              },
              steps: {
                orderBy: [
                  { jobLevel: { levelOrder: 'asc' } },
                  { stepNumber: 'asc' },
                ],
                include: {
                  jobLevel: {
                    select: {
                      id: true,
                      code: true,
                      title: true,
                      levelOrder: true,
                    },
                  },
                },
              },
            },
          });
        },
        { isolationLevel: 'Serializable' },
      );
    } catch (error: any) {
      if (error?.code === 'P2034') {
        throw new ConflictException(
          'Compensation scales changed at the same time; refresh and retry',
        );
      }
      throw error;
    }
  }

  private async visibleFrameworkOrganizations(user: AuthenticatedUser) {
    const allowed = organizationIdsForPermission(user, 'compensation.read');
    if (!allowed) return null;
    const graph = await this.prisma.organization.findMany({
      select: { id: true, parentId: true },
    });
    const parentById = new Map(graph.map(({ id, parentId }) => [id, parentId]));
    const visible = new Set(allowed);
    for (const organizationId of allowed) {
      let parentId = parentById.get(organizationId);
      while (parentId) {
        visible.add(parentId);
        parentId = parentById.get(parentId) ?? null;
      }
    }
    return [...visible];
  }

  private dateOnly(value: string, fieldName: string) {
    const match = /^\d{4}-\d{2}-\d{2}$/.exec(value);
    if (!match)
      throw new BadRequestException(`${fieldName} must use YYYY-MM-DD`);
    const date = new Date(`${value}T00:00:00.000Z`);
    if (
      Number.isNaN(date.getTime()) ||
      date.toISOString().slice(0, 10) !== value
    ) {
      throw new BadRequestException(
        `${fieldName} is not a valid calendar date`,
      );
    }
    return date;
  }
}
