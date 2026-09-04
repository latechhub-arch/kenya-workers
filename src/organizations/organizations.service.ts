import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrganizationDto } from './create-organization.dto';
import { UpdateOrganizationStatusDto } from './update-organization-status.dto';

@Injectable()
export class OrganizationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.organization.findMany({
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

  async findOne(id: string) {
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

    return organization;
  }

  async create(dto: CreateOrganizationDto) {
    if (dto.parentId) {
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

      if (parent.id === dto.parentId) {
        throw new ConflictException(
          'An organization cannot be its own parent',
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
