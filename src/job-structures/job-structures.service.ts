import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateJobFrameworkDto } from './create-job-framework.dto';
import { CreateJobLevelDto } from './create-job-level.dto';
import { CreateJobLevelAliasDto } from './create-job-level-alias.dto';
import { CreateJobPositionDto } from './create-job-position.dto';
import { AuthenticatedUser } from '../auth/auth.types';
import { assertOrganizationPermission, organizationIdsForPermission } from '../auth/organization-access';

@Injectable()
export class JobStructuresService {
  constructor(private readonly prisma: PrismaService) {}

  async findFrameworks(user: AuthenticatedUser) {
    const organizationIds = organizationIdsForPermission(user, 'jobFrameworks.read');
    let visibleOrganizationIds = organizationIds;
    if (organizationIds) {
      const graph = await this.prisma.organization.findMany({
        select: { id: true, parentId: true },
      });
      const parentById = new Map(graph.map(({ id, parentId }) => [id, parentId]));
      const visible = new Set(organizationIds);
      for (const organizationId of organizationIds) {
        let parentId = parentById.get(organizationId);
        while (parentId) {
          visible.add(parentId);
          parentId = parentById.get(parentId);
        }
      }
      visibleOrganizationIds = [...visible];
    }
    return this.prisma.jobFramework.findMany({
      where: visibleOrganizationIds
        ? { organizationId: { in: visibleOrganizationIds } }
        : undefined,
      orderBy: [{ organization: { name: 'asc' } }, { name: 'asc' }],
      include: {
        organization: { select: { id: true, code: true, name: true } },
        _count: { select: { levels: true, positions: true } },
      },
    });
  }

  async createFramework(dto: CreateJobFrameworkDto, user: AuthenticatedUser) {
    assertOrganizationPermission(user, dto.organizationId, 'jobFrameworks.create');
    const organization = await this.prisma.organization.findUnique({
      where: { id: dto.organizationId },
      select: { id: true, status: true },
    });
    if (!organization) throw new NotFoundException('Organization not found');
    if (organization.status !== 'ACTIVE') {
      throw new ConflictException('Framework organization must be active');
    }

    try {
      return await this.prisma.jobFramework.create({
        data: dto,
        include: {
          organization: { select: { id: true, code: true, name: true } },
        },
      });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new ConflictException(
          'Framework code already exists for this organization',
        );
      }
      throw error;
    }
  }

  async findLevels(frameworkId: string, user: AuthenticatedUser) {
    const framework = await this.prisma.jobFramework.findUnique({
      where: { id: frameworkId },
      select: { id: true, organizationId: true },
    });
    if (!framework) throw new NotFoundException('Job framework not found');
    await this.assertFrameworkReadAccess(framework.organizationId, user);

    return this.prisma.jobLevel.findMany({
      where: { frameworkId },
      orderBy: { levelOrder: 'asc' },
      include: {
        aliases: { orderBy: [{ scheme: 'asc' }, { code: 'asc' }] },
      },
    });
  }

  async createLevel(frameworkId: string, dto: CreateJobLevelDto, user: AuthenticatedUser) {
    const framework = await this.prisma.jobFramework.findUnique({
      where: { id: frameworkId },
      select: { id: true, organizationId: true },
    });
    if (!framework) throw new NotFoundException('Job framework not found');
    assertOrganizationPermission(user, framework.organizationId, 'jobLevels.create');

    try {
      return await this.prisma.jobLevel.create({
        data: { ...dto, frameworkId },
      });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new ConflictException(
          'Level code or order already exists in this framework',
        );
      }
      throw error;
    }
  }

  async createLevelAlias(
    frameworkId: string,
    levelId: string,
    dto: CreateJobLevelAliasDto,
    user: AuthenticatedUser,
  ) {
    const framework = await this.prisma.jobFramework.findUnique({
      where: { id: frameworkId },
      select: { id: true, organizationId: true },
    });
    if (!framework) throw new NotFoundException('Job framework not found');
    assertOrganizationPermission(user, framework.organizationId, 'jobLevels.create');

    const level = await this.prisma.jobLevel.findUnique({
      where: { id: levelId },
      select: { id: true, frameworkId: true },
    });
    if (!level) throw new NotFoundException('Job level not found');
    if (level.frameworkId !== frameworkId) {
      throw new ConflictException('Job level does not belong to this framework');
    }

    try {
      return await this.prisma.jobLevelAlias.create({
        data: { ...dto, frameworkId, jobLevelId: levelId },
      });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new ConflictException(
          'This framework label is already assigned to a job level',
        );
      }
      throw error;
    }
  }

  private async assertFrameworkReadAccess(
    frameworkOrganizationId: string,
    user: AuthenticatedUser,
  ) {
    if (user.globalPermissionCodes.includes('jobLevels.read')) return;
    const allowedOrganizations = organizationIdsForPermission(user, 'jobLevels.read') ?? [];
    const graph = await this.prisma.organization.findMany({
      select: { id: true, parentId: true },
    });
    const parentById = new Map(graph.map(({ id, parentId }) => [id, parentId]));
    for (const organizationId of allowedOrganizations) {
      let currentId: string | null = organizationId;
      while (currentId) {
        if (currentId === frameworkOrganizationId) return;
        currentId = parentById.get(currentId) ?? null;
      }
    }
    throw new ForbiddenException('You do not have access to this job framework');
  }

  private async isOrganizationWithinFramework(
    organizationId: string,
    frameworkOrganizationId: string,
  ) {
    const graph = await this.prisma.organization.findMany({
      select: { id: true, parentId: true },
    });
    const parentById = new Map(graph.map(({ id, parentId }) => [id, parentId]));
    let currentId: string | null = organizationId;
    while (currentId) {
      if (currentId === frameworkOrganizationId) return true;
      currentId = parentById.get(currentId) ?? null;
    }
    return false;
  }

  findPositions(user: AuthenticatedUser) {
    const organizationIds = organizationIdsForPermission(user, 'positions.read');
    return this.prisma.jobPosition.findMany({
      where: organizationIds ? { organizationId: { in: organizationIds } } : undefined,
      orderBy: [{ organization: { name: 'asc' } }, { code: 'asc' }],
      include: {
        organization: { select: { id: true, code: true, name: true } },
        department: { select: { id: true, code: true, name: true } },
        framework: { select: { id: true, code: true, name: true, type: true } },
        level: { select: { id: true, code: true, title: true, levelOrder: true } },
      },
    });
  }

  async createPosition(dto: CreateJobPositionDto, user: AuthenticatedUser) {
    assertOrganizationPermission(user, dto.organizationId, 'positions.create');
    const [organization, framework, level, department] = await Promise.all([
      this.prisma.organization.findUnique({
        where: { id: dto.organizationId },
        select: { id: true, status: true },
      }),
      this.prisma.jobFramework.findUnique({
        where: { id: dto.frameworkId },
        select: { id: true, organizationId: true },
      }),
      this.prisma.jobLevel.findUnique({
        where: { id: dto.levelId },
        select: { id: true, frameworkId: true },
      }),
      dto.departmentId
        ? this.prisma.department.findUnique({
            where: { id: dto.departmentId },
            select: { id: true, organizationId: true },
          })
        : Promise.resolve(null),
    ]);

    if (!organization) throw new NotFoundException('Organization not found');
    if (organization.status !== 'ACTIVE') {
      throw new ConflictException('Position organization must be active');
    }
    if (!framework) throw new NotFoundException('Job framework not found');
    if (!level) throw new NotFoundException('Job level not found');
    if (!(await this.isOrganizationWithinFramework(dto.organizationId, framework.organizationId))) {
      throw new ConflictException(
        'Job framework must belong to the selected organization or one of its parent organizations',
      );
    }
    if (level.frameworkId !== dto.frameworkId) {
      throw new ConflictException(
        'Job level does not belong to the selected framework',
      );
    }
    if (dto.departmentId && !department) {
      throw new NotFoundException('Department not found');
    }
    if (department && department.organizationId !== dto.organizationId) {
      throw new ConflictException(
        'Department does not belong to the selected organization',
      );
    }

    try {
      return await this.prisma.jobPosition.create({
        data: dto,
        include: {
          organization: { select: { id: true, code: true, name: true } },
          department: { select: { id: true, code: true, name: true } },
          framework: { select: { id: true, code: true, name: true, type: true } },
          level: { select: { id: true, code: true, title: true, levelOrder: true } },
        },
      });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new ConflictException(
          'Position code already exists for this organization',
        );
      }
      throw error;
    }
  }
}
