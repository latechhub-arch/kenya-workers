import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrganizationDto } from './create-organization.dto';
import { UpdateOrganizationStatusDto } from './update-organization-status.dto';
import { AuthenticatedUser } from '../auth/auth.types';
import { assertOrganizationPermission, organizationIdsForPermission } from '../auth/organization-access';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(user: AuthenticatedUser) {
    const organizationIds = organizationIdsForPermission(user, 'organizations.read');
    return this.prisma.organization.findMany({
      where: organizationIds ? { id: { in: organizationIds } } : undefined,
      orderBy: {
        name: 'asc',
      },
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        status: true,
        parentId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const organization = await this.prisma.organization.findUnique({
      where: { id },
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        status: true,
        parentId: true,
        createdAt: true,
        updatedAt: true,
        parent: {
          select: {
            id: true,
            code: true,
            name: true,
            type: true,
            status: true,
          },
        },
        children: {
          select: {
            id: true,
            code: true,
            name: true,
            type: true,
            status: true,
          },
          orderBy: {
            name: 'asc',
          },
        },
      },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }
    assertOrganizationPermission(user, id, 'organizations.read');

    return organization;
  }

  async create(dto: CreateOrganizationDto, user: AuthenticatedUser) {
    if (!dto.parentId && !user.globalPermissionCodes.includes('organizations.create')) {
      throw new ForbiddenException('Scoped users must create organizations under an assigned organization');
    }
    if (dto.parentId) {
      assertOrganizationPermission(user, dto.parentId, 'organizations.create');
      const parent = await this.prisma.organization.findUnique({
        where: {
          id: dto.parentId,
        },
        select: {
          id: true,
          status: true,
        },
      });

      if (!parent) {
        throw new NotFoundException('Parent organization not found');
      }

      if (parent.status !== 'ACTIVE') {
        throw new ConflictException(
          'Cannot create an organization under an inactive parent',
        );
      }

    }

    try {
      return await this.prisma.organization.create({
        data: {
          code: dto.code,
          name: dto.name,
          type: dto.type,
          parentId: dto.parentId,
        },
        select: {
          id: true,
          code: true,
          name: true,
          type: true,
          status: true,
          parentId: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new ConflictException(
          'Organization code already exists',
        );
      }

      throw error;
    }
  }

  async updateStatus(
    id: string,
    dto: UpdateOrganizationStatusDto,
    user: AuthenticatedUser,
  ) {
    const organization = await this.prisma.organization.findUnique({
      where: { id },
      select: {
        id: true,
      },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }
    assertOrganizationPermission(user, id, 'organizations.status.update');

    return this.prisma.organization.update({
      where: {
        id,
      },
      data: {
        status: dto.status,
      },
      select: {
        id: true,
        code: true,
        name: true,
        type: true,
        status: true,
        parentId: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }
}
