import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  InternalServerErrorException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHmac } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePersonDto } from './create-person.dto';
import { UpdatePersonStatusDto } from './update-person-status.dto';
import { AuthenticatedUser } from '../auth/auth.types';
import {
  assertOrganizationPermission,
  organizationIdsForPermission,
} from '../auth/organization-access';

@Injectable()
export class PersonsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(user: AuthenticatedUser) {
    const organizationIds = organizationIdsForPermission(user, 'persons.read');
    return this.prisma.person.findMany({
      where: organizationIds
        ? {
            organizationScopes: {
              some: { organizationId: { in: organizationIds } },
            },
          }
        : undefined,
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

  async findOne(id: string, user: AuthenticatedUser) {
    const organizationIds = organizationIdsForPermission(user, 'persons.read');
    const person = await this.prisma.person.findUnique({
      where: {
        id,
        ...(organizationIds
          ? {
              organizationScopes: {
                some: { organizationId: { in: organizationIds } },
              },
            }
          : {}),
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

    if (!person) {
      throw new NotFoundException('Person not found');
    }

    return person;
  }

  async create(dto: CreatePersonDto, user: AuthenticatedUser) {
    const allowedOrganizationIds = organizationIdsForPermission(
      user,
      'persons.create',
    );
    if (!allowedOrganizationIds && dto.organizationId) {
      assertOrganizationPermission(user, dto.organizationId, 'persons.create');
    } else if (allowedOrganizationIds) {
      if (!dto.organizationId) {
        throw new ForbiddenException(
          'organizationId is required for a scoped person record',
        );
      }
      assertOrganizationPermission(user, dto.organizationId, 'persons.create');
    }

    if (dto.organizationId) {
      const organization = await this.prisma.organization.findUnique({
        where: { id: dto.organizationId },
        select: { id: true, status: true },
      });
      if (!organization) throw new NotFoundException('Organization not found');
      if (organization.status !== 'ACTIVE') {
        throw new ConflictException(
          'Person record cannot be scoped to an inactive organization',
        );
      }
    }

    const nationalIdHash = dto.nationalId
      ? this.hashIdentifier('national-id', dto.nationalId)
      : undefined;
    const kraPinHash = dto.kraPin
      ? this.hashIdentifier('kra-pin', dto.kraPin)
      : undefined;

    if (
      nationalIdHash &&
      (await this.prisma.person.findUnique({
        where: { nationalIdHash },
        select: { id: true },
      }))
    ) {
      throw new ConflictException('National ID is already registered');
    }
    if (
      kraPinHash &&
      (await this.prisma.person.findUnique({
        where: { kraPinHash },
        select: { id: true },
      }))
    ) {
      throw new ConflictException('KRA PIN is already registered');
    }

    try {
      return await this.prisma.person.create({
        data: {
          personNumber: dto.personNumber,
          firstName: dto.firstName,
          middleName: dto.middleName,
          lastName: dto.lastName,
          dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
          nationalIdHash,
          kraPinHash,
          ...(dto.organizationId
            ? {
                organizationScopes: {
                  create: { organizationId: dto.organizationId },
                },
              }
            : {}),
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
        const target = error.meta?.target;
        const fields = Array.isArray(target)
          ? target.join(',')
          : String(target ?? '');
        if (
          fields.toLowerCase().includes('nationalid') ||
          (nationalIdHash &&
            (await this.prisma.person.findUnique({
              where: { nationalIdHash },
              select: { id: true },
            })))
        ) {
          throw new ConflictException('National ID is already registered');
        }
        if (
          fields.toLowerCase().includes('krapin') ||
          (kraPinHash &&
            (await this.prisma.person.findUnique({
              where: { kraPinHash },
              select: { id: true },
            })))
        ) {
          throw new ConflictException('KRA PIN is already registered');
        }
        throw new ConflictException('Person number already exists');
      }

      throw error;
    }
  }

  private hashIdentifier(kind: 'national-id' | 'kra-pin', value: string) {
    const secret = process.env.IDENTITY_HASH_SECRET;
    if (!secret || secret.length < 32) {
      throw new InternalServerErrorException(
        'Identity hashing is not configured; set IDENTITY_HASH_SECRET to a stable secret of at least 32 characters',
      );
    }

    const normalized = value.replace(/[\s-]/g, '').toUpperCase();
    if (!normalized) {
      throw new BadRequestException(`${kind} cannot be blank`);
    }
    return createHmac('sha256', secret)
      .update(`${kind}:${normalized}`)
      .digest('hex');
  }

  async updateStatus(
    id: string,
    dto: UpdatePersonStatusDto,
    user: AuthenticatedUser,
  ) {
    const organizationIds = organizationIdsForPermission(
      user,
      'persons.status.update',
    );
    const person = await this.prisma.person.findUnique({
      where: {
        id,
        ...(organizationIds
          ? {
              organizationScopes: {
                some: { organizationId: { in: organizationIds } },
              },
            }
          : {}),
      },
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
