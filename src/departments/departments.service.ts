import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDepartmentDto } from './create-department.dto';

@Injectable()
export class DepartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.department.findMany({
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

  async findOne(id: string) {
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

    return department;
  }

  async create(dto: CreateDepartmentDto) {
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
