import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EmploymentStatus, EmploymentType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmploymentDto } from './create-employment.dto';
import { UpdateEmploymentStatusDto } from './update-employment-status.dto';

@Injectable()
export class EmploymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.employment.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        employmentNumber: true,
        personId: true,
        organizationId: true,
        employmentType: true,
        status: true,
        appointmentDate: true,
        startDate: true,
        endDate: true,
        createdAt: true,
        updatedAt: true,
        person: {
          select: {
            id: true,
            personNumber: true,
            firstName: true,
            middleName: true,
            lastName: true,
            status: true,
          },
        },
        organization: {
          select: {
            id: true,
            code: true,
            name: true,
            type: true,
            status: true,
          },
        },
      },
    });
  }

  async findOne(id: string) {
    const employment = await this.prisma.employment.findUnique({
      where: { id },
      select: {
        id: true,
        employmentNumber: true,
        personId: true,
        organizationId: true,
        employmentType: true,
        status: true,
        appointmentDate: true,
        startDate: true,
        endDate: true,
        createdAt: true,
        updatedAt: true,
        person: {
          select: {
            id: true,
            personNumber: true,
            firstName: true,
            middleName: true,
            lastName: true,
            dateOfBirth: true,
            status: true,
          },
        },
        organization: {
          select: {
            id: true,
            code: true,
            name: true,
            type: true,
            status: true,
          },
        },
      },
    });

    if (!employment) {
      throw new NotFoundException('Employment not found');
    }

    return employment;
  }

  async create(dto: CreateEmploymentDto) {
    const person = await this.prisma.person.findUnique({
      where: {
        id: dto.personId,
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (!person) {
      throw new NotFoundException('Person not found');
    }

    const organization = await this.prisma.organization.findUnique({
      where: {
        id: dto.organizationId,
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (!organization) {
      throw new NotFoundException('Organization not found');
    }

    const startDate = new Date(dto.startDate);

    if (Number.isNaN(startDate.getTime())) {
      throw new ConflictException('Invalid start date');
    }

    const appointmentDate = dto.appointmentDate
      ? new Date(dto.appointmentDate)
      : undefined;

    if (appointmentDate && Number.isNaN(appointmentDate.getTime())) {
      throw new ConflictException('Invalid appointment date');
    }

    const endDate = dto.endDate ? new Date(dto.endDate) : undefined;

    if (endDate && Number.isNaN(endDate.getTime())) {
      throw new ConflictException('Invalid end date');
    }

    if (endDate && endDate < startDate) {
      throw new ConflictException(
        'End date cannot be earlier than start date',
      );
    }

    if (appointmentDate && appointmentDate > startDate) {
      throw new ConflictException(
        'Appointment date cannot be later than start date',
      );
    }

    if (person.status !== 'ACTIVE') {
      throw new ConflictException(
        'Employment cannot be created for an inactive person',
      );
    }

    if (organization.status !== 'ACTIVE') {
      throw new ConflictException(
        'Employment cannot be created for an inactive organization',
      );
    }

    try {
      return await this.prisma.employment.create({
        data: {
          employmentNumber: dto.employmentNumber,
          personId: dto.personId,
          organizationId: dto.organizationId,
          employmentType: dto.employmentType,
          status: EmploymentStatus.ACTIVE,
          appointmentDate,
          startDate,
          endDate,
        },
        select: {
          id: true,
          employmentNumber: true,
          personId: true,
          organizationId: true,
          employmentType: true,
          status: true,
          appointmentDate: true,
          startDate: true,
          endDate: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new ConflictException(
          'Employment number already exists',
        );
      }

      throw error;
    }
  }

  async updateStatus(id: string, dto: UpdateEmploymentStatusDto) {
    const employment = await this.prisma.employment.findUnique({
      where: { id },
      select: {
        id: true,
      },
    });

    if (!employment) {
      throw new NotFoundException('Employment not found');
    }

    return this.prisma.employment.update({
      where: {
        id,
      },
      data: {
        status: dto.status,
      },
      select: {
        id: true,
        employmentNumber: true,
        personId: true,
        organizationId: true,
        employmentType: true,
        status: true,
        appointmentDate: true,
        startDate: true,
        endDate: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }
}
