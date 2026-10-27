import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDepartmentDto } from './create-department.dto';
import { AuthenticatedUser } from '../auth/auth.types';
import { assertOrganizationPermission, organizationIdsForPermission } from '../auth/organization-access';

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(user: AuthenticatedUser) {
    const organizationIds = organizationIdsForPermission(user, 'departments.read');
    return this.prisma.department.findMany({
      where: organizationIds ? { organizationId: { in: organizationIds } } : undefined,
      orderBy: {
        name: 'asc',
      },
      include: {
        organization: {
          select: {
            id: true,
            code: true,
            name: true,
            status: true,
          },
        },
      },
    });
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const department = await this.prisma.department.findUnique({
      where: { id },
      include: {
        organization: {
          select: {
            id: true,
            code: true,
            name: true,
            status: true,
          },
        },
        stations: true,
      },
    });

    if (!department) {
      throw new NotFoundException('Department not found');
    }
    assertOrganizationPermission(user, department.organizationId, 'departments.read');

    return department;
  }

  async create(dto: CreateDepartmentDto, user: AuthenticatedUser) {
    assertOrganizationPermission(user, dto.organizationId, 'departments.create');
    const organization = await this.prisma.organization.findUnique({
      where: {
        id: dto.organizationId,
      },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    if (organization.status === 'INACTIVE') {
      throw new ConflictException(
        'Department cannot be created under an inactive organization',
      );
    }

    try {
      return await this.prisma.department.create({
        data: {
          organizationId: dto.organizationId,
          code: dto.code,
          name: dto.name,
        },
        include: {
          organization: {
            select: {
              id: true,
              code: true,
              name: true,
              status: true,
            },
          },
        },
      });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new ConflictException(
          'Department code already exists in this organization',
        );
      }

      throw error;
    }
  }
}
