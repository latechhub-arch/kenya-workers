import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EmploymentStatus, EmploymentType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEmploymentDto } from './create-employment.dto';
import { CreateEmploymentPositionAssignmentDto } from './create-employment-position-assignment.dto';
import { CreateEmploymentPostingDto } from './create-employment-posting.dto';
import { UpdateEmploymentStatusDto } from './update-employment-status.dto';
import { AuthenticatedUser } from '../auth/auth.types';
import { assertOrganizationPermission, organizationIdsForPermission } from '../auth/organization-access';

@Injectable()
export class EmploymentsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Keep the employment's current-location snapshot aligned with the latest
   * posting whose effective date has arrived. Future postings remain history
   * until their effective date.
   */
  private async applyDuePostings(employmentId?: string) {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const duePostings = await this.prisma.employmentPosting.findMany({
      where: {
        effectiveFrom: { lte: today },
        ...(employmentId ? { employmentId } : {}),
      },
      orderBy: [{ employmentId: 'asc' }, { effectiveFrom: 'desc' }],
      distinct: ['employmentId'],
      select: {
        employmentId: true,
        organizationId: true,
        departmentId: true,
        stationId: true,
        employment: { select: { personId: true } },
      },
    });

    for (const posting of duePostings) {
      await this.prisma.$transaction(async (tx) => {
        const current = await tx.employment.findUnique({
          where: { id: posting.employmentId },
          select: { organizationId: true, departmentId: true, stationId: true },
        });
        if (!current) return;

        if (
          current.organizationId !== posting.organizationId ||
          current.departmentId !== posting.departmentId ||
          current.stationId !== posting.stationId
        ) {
          await tx.employment.update({
            where: { id: posting.employmentId },
            data: {
              organizationId: posting.organizationId,
              departmentId: posting.departmentId,
              stationId: posting.stationId,
            },
          });
        }

        await tx.personOrganizationScope.upsert({
          where: {
            personId_organizationId: {
              personId: posting.employment.personId,
              organizationId: posting.organizationId,
            },
          },
          create: {
            personId: posting.employment.personId,
            organizationId: posting.organizationId,
          },
          update: {},
        });
      });
    }
  }

  async findAll(user: AuthenticatedUser) {
    await this.applyDuePostings();
    const organizationIds = organizationIdsForPermission(user, 'employments.read');
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    return this.prisma.employment.findMany({
      where: organizationIds ? { organizationId: { in: organizationIds } } : undefined,
      orderBy: {
        createdAt: 'desc',
      },
      select: {
        id: true,
        employmentNumber: true,
        personId: true,
        organizationId: true,
        departmentId: true,
        stationId: true,
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
        department: {
          select: { id: true, code: true, name: true },
        },
        station: {
          select: {
            id: true,
            code: true,
            name: true,
            latitude: true,
            longitude: true,
            geofenceRadius: true,
          },
        },
        positionAssignments: {
          where: {
            effectiveFrom: { lte: today },
            OR: [{ effectiveTo: null }, { effectiveTo: { gte: today } }],
          },
          orderBy: { effectiveFrom: 'desc' },
          take: 1,
          include: {
            position: {
              include: {
                framework: { select: { id: true, code: true, name: true, type: true } },
                level: { select: { id: true, code: true, title: true, levelOrder: true } },
              },
            },
          },
        },
      },
    });
  }

  async findOne(id: string, user: AuthenticatedUser) {
    await this.applyDuePostings(id);
    const organizationIds = organizationIdsForPermission(user, 'employments.read');
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const employment = await this.prisma.employment.findUnique({
      where: { id, ...(organizationIds ? { organizationId: { in: organizationIds } } : {}) },
      select: {
        id: true,
        employmentNumber: true,
        personId: true,
        organizationId: true,
        departmentId: true,
        stationId: true,
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
        department: {
          select: { id: true, code: true, name: true },
        },
        station: {
          select: {
            id: true,
            code: true,
            name: true,
            latitude: true,
            longitude: true,
            geofenceRadius: true,
          },
        },
        positionAssignments: {
          where: {
            effectiveFrom: { lte: today },
            OR: [{ effectiveTo: null }, { effectiveTo: { gte: today } }],
          },
          orderBy: { effectiveFrom: 'desc' },
          take: 1,
          include: {
            position: {
              include: {
                framework: { select: { id: true, code: true, name: true, type: true } },
                level: { select: { id: true, code: true, title: true, levelOrder: true } },
              },
            },
          },
        },
      },
    });

    if (!employment) {
      throw new NotFoundException('Employment not found');
    }

    return employment;
  }

  async create(dto: CreateEmploymentDto, user: AuthenticatedUser) {
    assertOrganizationPermission(user, dto.organizationId, 'employments.create');
    const person = await this.prisma.person.findUnique({
      where: {
        id: dto.personId,
      },
      select: {
        id: true,
        status: true,
        organizationScopes: { select: { organizationId: true } },
      },
    });

    if (!person) {
      throw new NotFoundException('Person not found');
    }

    const personOrganizationIds = organizationIdsForPermission(user, 'persons.read');
    if (
      personOrganizationIds &&
      !person.organizationScopes.some(({ organizationId }) =>
        personOrganizationIds.includes(organizationId),
      )
    ) {
      throw new ForbiddenException('Person is not in an organization you can access');
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

    let departmentId = dto.departmentId;
    let station: {
      id: string;
      organizationId: string;
      departmentId: string | null;
    } | null = null;

    if (dto.stationId) {
      station = await this.prisma.station.findUnique({
        where: { id: dto.stationId },
        select: { id: true, organizationId: true, departmentId: true },
      });

      if (!station) {
        throw new NotFoundException('Station not found');
      }

      if (station.organizationId !== dto.organizationId) {
        throw new ConflictException(
          'Station does not belong to the selected organization',
        );
      }

      if (station.departmentId) {
        if (departmentId && station.departmentId !== departmentId) {
          throw new ConflictException(
            'Station does not belong to the selected department',
          );
        }
        departmentId ??= station.departmentId;
      }
    }

    if (departmentId) {
      const department = await this.prisma.department.findUnique({
        where: { id: departmentId },
        select: { id: true, organizationId: true },
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
      return await this.prisma.$transaction(async (tx) => {
        await tx.personOrganizationScope.upsert({
          where: {
            personId_organizationId: {
              personId: dto.personId,
              organizationId: dto.organizationId,
            },
          },
          create: { personId: dto.personId, organizationId: dto.organizationId },
          update: {},
        });
        return tx.employment.create({
        data: {
          employmentNumber: dto.employmentNumber,
          personId: dto.personId,
          organizationId: dto.organizationId,
          departmentId,
          stationId: dto.stationId,
          employmentType: dto.employmentType,
          status: EmploymentStatus.ACTIVE,
          appointmentDate,
          startDate,
          endDate,
          postings: {
            create: {
              organizationId: dto.organizationId,
              departmentId,
              stationId: dto.stationId,
              effectiveFrom: startDate,
              reason: 'Initial employment assignment',
            },
          },
        },
        select: {
          id: true,
          employmentNumber: true,
          personId: true,
          organizationId: true,
          departmentId: true,
          stationId: true,
          employmentType: true,
          status: true,
          appointmentDate: true,
          startDate: true,
          endDate: true,
          createdAt: true,
          updatedAt: true,
          department: {
            select: { id: true, code: true, name: true },
          },
          station: {
            select: {
              id: true,
              code: true,
              name: true,
              latitude: true,
              longitude: true,
              geofenceRadius: true,
            },
          },
          postings: {
            orderBy: { effectiveFrom: 'asc' },
            select: {
              id: true,
              organizationId: true,
              departmentId: true,
              stationId: true,
              effectiveFrom: true,
              effectiveTo: true,
              reason: true,
            },
          },
        },
      });
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

  async findPostings(employmentId: string, user: AuthenticatedUser) {
    await this.applyDuePostings(employmentId);
    const organizationIds = organizationIdsForPermission(user, 'postings.read');
    const employment = await this.prisma.employment.findUnique({
      where: { id: employmentId },
      select: { id: true, organizationId: true },
    });

    if (!employment) {
      throw new NotFoundException('Employment not found');
    }
    assertOrganizationPermission(user, employment.organizationId, 'postings.read');

    return this.prisma.employmentPosting.findMany({
      where: {
        employmentId,
        ...(organizationIds ? { organizationId: { in: organizationIds } } : {}),
      },
      orderBy: { effectiveFrom: 'asc' },
      select: {
        id: true,
        employmentId: true,
        organizationId: true,
        departmentId: true,
        stationId: true,
        effectiveFrom: true,
        effectiveTo: true,
        reason: true,
        createdAt: true,
        organization: {
          select: { id: true, code: true, name: true },
        },
        department: {
          select: { id: true, code: true, name: true },
        },
        station: {
          select: { id: true, code: true, name: true },
        },
      },
    });
  }

  async findPositionAssignments(employmentId: string, user: AuthenticatedUser) {
    await this.applyDuePostings(employmentId);
    const employment = await this.prisma.employment.findUnique({
      where: { id: employmentId },
      select: { id: true, organizationId: true },
    });
    if (!employment) throw new NotFoundException('Employment not found');
    assertOrganizationPermission(user, employment.organizationId, 'employmentPositions.read');

    const organizationIds = organizationIdsForPermission(user, 'employmentPositions.read');
    return this.prisma.employmentPositionAssignment.findMany({
      where: {
        employmentId,
        ...(organizationIds
          ? { position: { organizationId: { in: organizationIds } } }
          : {}),
      },
      orderBy: { effectiveFrom: 'asc' },
      include: {
        position: {
          include: {
            organization: { select: { id: true, code: true, name: true } },
            department: { select: { id: true, code: true, name: true } },
            framework: { select: { id: true, code: true, name: true, type: true } },
            level: { select: { id: true, code: true, title: true, levelOrder: true } },
          },
        },
      },
    });
  }

  async createPositionAssignment(
    employmentId: string,
    dto: CreateEmploymentPositionAssignmentDto,
    user: AuthenticatedUser,
  ) {
    await this.applyDuePostings(employmentId);
    const effectiveFrom = new Date(dto.effectiveFrom);
    if (Number.isNaN(effectiveFrom.getTime())) {
      throw new ConflictException('Invalid effectiveFrom date');
    }
    try {
      return await this.prisma.$transaction(async (tx) => {
        const employment = await tx.employment.findUnique({
          where: { id: employmentId },
          select: {
            id: true,
            organizationId: true,
            departmentId: true,
            status: true,
            startDate: true,
            endDate: true,
          },
        });
        if (!employment) throw new NotFoundException('Employment not found');
        assertOrganizationPermission(user, employment.organizationId, 'employmentPositions.assign');
        if (employment.status !== EmploymentStatus.ACTIVE) {
          throw new ConflictException('Only active employment can receive a position assignment');
        }
        if (effectiveFrom < employment.startDate) {
          throw new ConflictException('Position assignment cannot predate employment start');
        }
        if (employment.endDate && effectiveFrom > employment.endDate) {
          throw new ConflictException('Position assignment cannot postdate employment end');
        }

        const postingAtEffectiveDate = await tx.employmentPosting.findFirst({
          where: { employmentId, effectiveFrom: { lte: effectiveFrom } },
          orderBy: { effectiveFrom: 'desc' },
          select: { organizationId: true, departmentId: true },
        });
        const organizationIdAtEffectiveDate =
          postingAtEffectiveDate?.organizationId ?? employment.organizationId;
        const departmentIdAtEffectiveDate = postingAtEffectiveDate
          ? postingAtEffectiveDate.departmentId
          : employment.departmentId;

        const position = await tx.jobPosition.findUnique({
          where: { id: dto.positionId },
          include: {
            organization: { select: { id: true, status: true } },
            department: { select: { id: true, code: true, name: true } },
            framework: { select: { id: true, code: true, name: true, type: true } },
            level: { select: { id: true, code: true, title: true, levelOrder: true } },
          },
        });
        if (!position) throw new NotFoundException('Job position not found');
        assertOrganizationPermission(user, position.organizationId, 'employmentPositions.assign');
        if (position.organizationId !== organizationIdAtEffectiveDate) {
          throw new ConflictException('Job position does not belong to the employment organization');
        }
        if (position.organization.status !== 'ACTIVE') {
          throw new ConflictException('Cannot assign a position in an inactive organization');
        }
        if (position.departmentId && position.departmentId !== departmentIdAtEffectiveDate) {
          throw new ConflictException('Job position does not belong to the employment department');
        }

        const latest = await tx.employmentPositionAssignment.findFirst({
          where: { employmentId },
          orderBy: { effectiveFrom: 'desc' },
          select: { id: true, positionId: true, effectiveFrom: true, effectiveTo: true },
        });
        if (latest && effectiveFrom <= latest.effectiveFrom) {
          throw new ConflictException('Position assignment date must be later than the latest recorded assignment');
        }
        if (latest?.effectiveTo === null && latest.positionId === position.id) {
          throw new ConflictException('This job position is already assigned to the employment');
        }

        const occupiedSlots = await tx.employmentPositionAssignment.count({
          where: {
            positionId: position.id,
            effectiveFrom: { lte: effectiveFrom },
            OR: [{ effectiveTo: null }, { effectiveTo: { gte: effectiveFrom } }],
          },
        });
        if (occupiedSlots >= position.authorizedSlots) {
          throw new ConflictException('All authorized slots for this job position are occupied');
        }

        if (latest && latest.effectiveTo === null) {
          const previousDay = new Date(effectiveFrom);
          previousDay.setUTCDate(previousDay.getUTCDate() - 1);
          await tx.employmentPositionAssignment.update({
            where: { id: latest.id },
            data: { effectiveTo: previousDay },
          });
        }

        return tx.employmentPositionAssignment.create({
          data: {
            employmentId,
            positionId: position.id,
            effectiveFrom,
            reason: dto.reason,
          },
          include: {
            position: {
              include: {
                organization: { select: { id: true, code: true, name: true } },
                department: { select: { id: true, code: true, name: true } },
                framework: { select: { id: true, code: true, name: true, type: true } },
                level: { select: { id: true, code: true, title: true, levelOrder: true } },
              },
            },
          },
        });
      }, { isolationLevel: 'Serializable' });
    } catch (error: any) {
      if (error?.code === 'P2002' || error?.code === 'P2034') {
        throw new ConflictException('Position assignment changed at the same time; refresh and retry');
      }
      throw error;
    }
  }

  async createPosting(
    employmentId: string,
    dto: CreateEmploymentPostingDto,
    user: AuthenticatedUser,
  ) {
    await this.applyDuePostings(employmentId);
    assertOrganizationPermission(user, dto.organizationId, 'postings.create');
    const effectiveFrom = new Date(dto.effectiveFrom);
    if (Number.isNaN(effectiveFrom.getTime())) {
      throw new ConflictException('Invalid effectiveFrom date');
    }

    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const employment = await tx.employment.findUnique({
            where: { id: employmentId },
            select: {
              id: true,
              personId: true,
              employmentNumber: true,
              organizationId: true,
              departmentId: true,
              stationId: true,
              status: true,
              startDate: true,
              endDate: true,
            },
          });

          if (!employment) {
            throw new NotFoundException('Employment not found');
          }

          assertOrganizationPermission(user, employment.organizationId, 'postings.create');

          if (employment.status !== EmploymentStatus.ACTIVE) {
            throw new ConflictException(
              'Only active employment can be transferred',
            );
          }

          if (effectiveFrom < employment.startDate) {
            throw new ConflictException(
              'Posting date cannot be earlier than employment start date',
            );
          }

          if (employment.endDate && effectiveFrom > employment.endDate) {
            throw new ConflictException(
              'Posting date cannot be later than employment end date',
            );
          }

          const organization = await tx.organization.findUnique({
            where: { id: dto.organizationId },
            select: { id: true, status: true },
          });

          if (!organization) {
            throw new NotFoundException('Organization not found');
          }

          if (organization.status !== 'ACTIVE') {
            throw new ConflictException(
              'Posting cannot be created under an inactive organization',
            );
          }

          let departmentId = dto.departmentId;
          let station: {
            organizationId: string;
            departmentId: string | null;
          } | null = null;

          if (dto.stationId) {
            station = await tx.station.findUnique({
              where: { id: dto.stationId },
              select: { organizationId: true, departmentId: true },
            });

            if (!station) {
              throw new NotFoundException('Station not found');
            }

            if (station.organizationId !== dto.organizationId) {
              throw new ConflictException(
                'Station does not belong to the selected organization',
              );
            }

            if (station.departmentId) {
              if (departmentId && station.departmentId !== departmentId) {
                throw new ConflictException(
                  'Station does not belong to the selected department',
                );
              }
              departmentId ??= station.departmentId;
            }
          }

          if (departmentId) {
            const department = await tx.department.findUnique({
              where: { id: departmentId },
              select: { organizationId: true },
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

          const latestPosting = await tx.employmentPosting.findFirst({
            where: { employmentId },
            orderBy: { effectiveFrom: 'desc' },
            select: {
              id: true,
              organizationId: true,
              departmentId: true,
              stationId: true,
              effectiveFrom: true,
              effectiveTo: true,
            },
          });

          if (latestPosting && effectiveFrom <= latestPosting.effectiveFrom) {
            throw new ConflictException(
              'Posting date must be later than the latest recorded posting',
            );
          }

          const previousLocation = latestPosting ?? employment;
          if (
            previousLocation.organizationId === dto.organizationId &&
            previousLocation.departmentId === (departmentId ?? null) &&
            previousLocation.stationId === (dto.stationId ?? null)
          ) {
            throw new ConflictException(
              'The new posting must change the organization, department, or station',
            );
          }

          if (latestPosting && latestPosting.effectiveTo === null) {
            const previousDay = new Date(effectiveFrom);
            previousDay.setUTCDate(previousDay.getUTCDate() - 1);

            await tx.employmentPosting.update({
              where: { id: latestPosting.id },
              data: { effectiveTo: previousDay },
            });
          }

          const activePositionAssignment = await tx.employmentPositionAssignment.findFirst({
            where: {
              employmentId,
              effectiveFrom: { lte: effectiveFrom },
              OR: [{ effectiveTo: null }, { effectiveTo: { gte: effectiveFrom } }],
            },
            orderBy: { effectiveFrom: 'desc' },
            include: {
              position: { select: { organizationId: true, departmentId: true } },
            },
          });
          if (
            activePositionAssignment &&
            (activePositionAssignment.position.organizationId !== dto.organizationId ||
              (activePositionAssignment.position.departmentId !== null &&
                activePositionAssignment.position.departmentId !== (departmentId ?? null)))
          ) {
            if (effectiveFrom <= activePositionAssignment.effectiveFrom) {
              throw new ConflictException(
                'Transfer date must be later than the current position assignment date',
              );
            }
            const previousDay = new Date(effectiveFrom);
            previousDay.setUTCDate(previousDay.getUTCDate() - 1);
            await tx.employmentPositionAssignment.update({
              where: { id: activePositionAssignment.id },
              data: { effectiveTo: previousDay },
            });
          }

          const futurePositionAssignments = await tx.employmentPositionAssignment.findMany({
            where: {
              employmentId,
              effectiveFrom: { gt: effectiveFrom },
              OR: [{ effectiveTo: null }, { effectiveTo: { gte: effectiveFrom } }],
            },
            include: {
              position: { select: { organizationId: true, departmentId: true } },
            },
          });
          const conflictsWithFutureAssignment = futurePositionAssignments.some(
            ({ position }) =>
              position.organizationId !== dto.organizationId ||
              (position.departmentId !== null && position.departmentId !== (departmentId ?? null)),
          );
          if (conflictsWithFutureAssignment) {
            throw new ConflictException(
              'Transfer conflicts with a scheduled position assignment; align the transfer date with that assignment',
            );
          }

          const posting = await tx.employmentPosting.create({
            data: {
              employmentId,
              organizationId: dto.organizationId,
              departmentId,
              stationId: dto.stationId,
              effectiveFrom,
              reason: dto.reason,
            },
            select: {
              id: true,
              employmentId: true,
              organizationId: true,
              departmentId: true,
              stationId: true,
              effectiveFrom: true,
              effectiveTo: true,
              reason: true,
              createdAt: true,
            },
          });

          let updatedEmployment;
          if (effectiveFrom <= today) {
            updatedEmployment = await tx.employment.update({
              where: { id: employmentId },
              data: {
                organizationId: dto.organizationId,
                departmentId,
                stationId: dto.stationId,
              },
              select: {
                id: true,
                employmentNumber: true,
                organizationId: true,
                departmentId: true,
                stationId: true,
                status: true,
              },
            });

            await tx.personOrganizationScope.upsert({
              where: {
                personId_organizationId: {
                  personId: employment.personId,
                  organizationId: dto.organizationId,
                },
              },
              create: { personId: employment.personId, organizationId: dto.organizationId },
              update: {},
            });
          } else {
            updatedEmployment = {
              id: employment.id,
              employmentNumber: employment.employmentNumber,
              organizationId: employment.organizationId,
              departmentId: employment.departmentId,
              stationId: employment.stationId,
              status: employment.status,
            };
          }

          return { employment: updatedEmployment, posting };
        },
        { isolationLevel: 'Serializable' },
      );
    } catch (error: any) {
      if (error?.code === 'P2002' || error?.code === 'P2034') {
        throw new ConflictException(
          'A posting already exists for this date; refresh the history and retry',
        );
      }

      throw error;
    }
  }

  async updateStatus(id: string, dto: UpdateEmploymentStatusDto, user: AuthenticatedUser) {
    await this.applyDuePostings(id);
    const terminalStatuses: EmploymentStatus[] = [
      EmploymentStatus.ENDED,
      EmploymentStatus.RETIRED,
      EmploymentStatus.TERMINATED,
      EmploymentStatus.RESIGNED,
      EmploymentStatus.DISMISSED,
      EmploymentStatus.DECEASED,
    ];
    const isTerminal = terminalStatuses.includes(dto.status);

    if (isTerminal && !dto.effectiveDate) {
      throw new ConflictException(
        'An effectiveDate is required when employment ends',
      );
    }
    if (!isTerminal && dto.effectiveDate) {
      throw new ConflictException(
        'effectiveDate is only used when employment ends',
      );
    }

    const effectiveDate = dto.effectiveDate
      ? new Date(`${dto.effectiveDate}T00:00:00.000Z`)
      : undefined;
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    if (effectiveDate && effectiveDate > today) {
      throw new ConflictException('Employment cannot end in the future');
    }

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const employment = await tx.employment.findUnique({
            where: { id },
            select: { id: true, organizationId: true, status: true, startDate: true, endDate: true },
          });

          if (!employment) {
            throw new NotFoundException('Employment not found');
          }

          assertOrganizationPermission(user, employment.organizationId, 'employments.status.update');

          if (terminalStatuses.includes(employment.status)) {
            throw new ConflictException(
              'Closed employment cannot be changed or reopened',
            );
          }

          if (isTerminal && effectiveDate) {
            if (effectiveDate < employment.startDate) {
              throw new ConflictException(
                'End date cannot be earlier than employment start date',
              );
            }
            if (employment.endDate && effectiveDate > employment.endDate) {
              throw new ConflictException(
                'End date cannot be later than the recorded employment end date',
              );
            }

            const openPosting = await tx.employmentPosting.findFirst({
              where: { employmentId: id, effectiveTo: null },
              orderBy: { effectiveFrom: 'desc' },
              select: { id: true, effectiveFrom: true },
            });

            if (!openPosting) {
              throw new ConflictException(
                'No active posting was found to close for this employment',
              );
            }
            if (effectiveDate < openPosting.effectiveFrom) {
              throw new ConflictException(
                'End date cannot be earlier than the current posting start date',
              );
            }

            await tx.employmentPosting.update({
              where: { id: openPosting.id },
              data: { effectiveTo: effectiveDate },
            });

            const activePositionAssignment = await tx.employmentPositionAssignment.findFirst({
              where: { employmentId: id, effectiveTo: null },
              select: { id: true, effectiveFrom: true },
            });
            if (activePositionAssignment) {
              if (effectiveDate < activePositionAssignment.effectiveFrom) {
                throw new ConflictException(
                  'Employment end date cannot be earlier than the current position assignment start date',
                );
              }
              await tx.employmentPositionAssignment.update({
                where: { id: activePositionAssignment.id },
                data: { effectiveTo: effectiveDate },
              });
            }
          }

          return tx.employment.update({
            where: { id },
            data: {
              status: dto.status,
              ...(isTerminal ? { endDate: effectiveDate } : {}),
            },
            select: {
              id: true,
              employmentNumber: true,
              personId: true,
              organizationId: true,
              departmentId: true,
              stationId: true,
              employmentType: true,
              status: true,
              appointmentDate: true,
              startDate: true,
              endDate: true,
              createdAt: true,
              updatedAt: true,
            },
          });
        },
        { isolationLevel: 'Serializable' },
      );
    } catch (error: any) {
      if (error?.code === 'P2034') {
        throw new ConflictException(
          'Employment changed at the same time; refresh and retry',
        );
      }
      throw error;
    }
  }
}
