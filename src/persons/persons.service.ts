import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePersonDto } from './create-person.dto';
import { UpdatePersonStatusDto } from './update-person-status.dto';

@Injectable()
export class PersonsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.person.findMany({
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        personNumber: true,
        firstName: true,
        middleName: true,
        lastName: true,
        dateOfBirth: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async findOne(id: string) {
    const person = await this.prisma.person.findUnique({
      where: { id },
      select: {
        id: true,
        personNumber: true,
        firstName: true,
        middleName: true,
        lastName: true,
        dateOfBirth: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!person) {
      throw new NotFoundException('Person not found');
    }

    return person;
  }

  async create(dto: CreatePersonDto) {
    try {
      return await this.prisma.person.create({
        data: {
          personNumber: dto.personNumber,
          firstName: dto.firstName,
          middleName: dto.middleName,
          lastName: dto.lastName,
          dateOfBirth: dto.dateOfBirth
            ? new Date(dto.dateOfBirth)
            : undefined,
        },
        select: {
          id: true,
          personNumber: true,
          firstName: true,
          middleName: true,
          lastName: true,
          dateOfBirth: true,
          status: true,
          createdAt: true,
          updatedAt: true,
        },
      });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new ConflictException('Person number already exists');
      }

      throw error;
    }
  }

  async updateStatus(id: string, dto: UpdatePersonStatusDto) {
    const person = await this.prisma.person.findUnique({
      where: { id },
    });

    if (!person) {
      throw new NotFoundException('Person not found');
    }

    return this.prisma.person.update({
      where: { id },
      data: {
        status: dto.status,
      },
      select: {
        id: true,
        personNumber: true,
        firstName: true,
        middleName: true,
        lastName: true,
        dateOfBirth: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }
}