import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateStationDto } from './create-station.dto';
import { AuthenticatedUser } from '../auth/auth.types';
import { assertOrganizationPermission, organizationIdsForPermission } from '../auth/organization-access';

@Injectable()
export class StationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(user: AuthenticatedUser) {
    const organizationIds = organizationIdsForPermission(user, 'stations.read');
    return this.prisma.station.findMany({
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
        department: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    });
  }

  async findOne(id: string, user: AuthenticatedUser) {
    const station = await this.prisma.station.findUnique({
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
        department: {
          select: {
            id: true,
            code: true,
            name: true,
          },
        },
      },
    });

    if (!station) {
      throw new NotFoundException('Station not found');
    }
    assertOrganizationPermission(user, station.organizationId, 'stations.read');

    return station;
  }

  async create(dto: CreateStationDto, user: AuthenticatedUser) {
    assertOrganizationPermission(user, dto.organizationId, 'stations.create');
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
        'Station cannot be created under an inactive organization',
      );
    }

    if (dto.departmentId) {
      const department = await this.prisma.department.findUnique({
        where: {
          id: dto.departmentId,
        },
      });

      if (!department) {
        throw new NotFoundException('Department not found');
      }

      if (department.organizationId !== dto.organizationId) {
        throw new ConflictException(
          'Department does not belong to the selected organization',
        );
      }
    }

    try {
      return await this.prisma.station.create({
        data: {
          organizationId: dto.organizationId,
          departmentId: dto.departmentId,
          code: dto.code,
          name: dto.name,
          latitude: dto.latitude,
          longitude: dto.longitude,
          geofenceRadius: dto.geofenceRadius,
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
          department: {
            select: {
              id: true,
              code: true,
              name: true,
            },
          },
        },
      });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new ConflictException(
          'Station code already exists in this organization',
        );
      }

      throw error;
    }
  }
}
