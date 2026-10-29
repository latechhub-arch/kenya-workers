import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import {
  createHash,
  randomBytes,
  timingSafeEqual,
} from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AUTH_SESSION_HOURS, PERMISSIONS, ROLE_DEFINITIONS } from './auth.constants';
import { CreateBootstrapDto } from './create-bootstrap.dto';
import { CreateUserDto } from './create-user.dto';
import { ChangePasswordDto } from './change-password.dto';
import { LoginDto } from './login.dto';
import { UpdateUserRolesDto } from './update-user-roles.dto';
import { UpdateUserStatusDto } from './update-user-status.dto';
import { UpdateMyProfileDto } from './update-my-profile.dto';
import { CreateEmployeeAccountInviteDto } from './create-employee-account-invite.dto';
import { RegisterEmployeeAccountDto } from './register-employee-account.dto';
import { RoleAssignmentDto } from './role-assignment.dto';
import { hashPassword, verifyPassword } from './password.util';
import { AuthenticatedUser } from './auth.types';

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    const permissionIds = new Map<string, string>();
    for (const code of PERMISSIONS) {
      const permission = await this.prisma.permission.upsert({
        where: { code },
        update: { description: `${code} access` },
        create: { code, description: `${code} access` },
      });
      permissionIds.set(code, permission.id);
    }

    for (const [code, definition] of Object.entries(ROLE_DEFINITIONS)) {
      const role = await this.prisma.role.upsert({
        where: { code },
        update: {
          name: definition.name,
          description: definition.description,
        },
        create: {
          code,
          name: definition.name,
          description: definition.description,
        },
      });

      await this.prisma.$transaction([
        this.prisma.rolePermission.deleteMany({ where: { roleId: role.id } }),
        this.prisma.rolePermission.createMany({
          data: definition.permissions.map((permissionCode) => ({
            roleId: role.id,
            permissionId: permissionIds.get(permissionCode)!,
          })),
          skipDuplicates: true,
        }),
      ]);
    }
  }

  async bootstrap(dto: CreateBootstrapDto) {
    const configuredSecret = process.env.BOOTSTRAP_SECRET;
    if (!configuredSecret || !this.constantTimeEquals(dto.bootstrapSecret, configuredSecret)) {
      throw new UnauthorizedException('Invalid bootstrap credentials');
    }

    try {
      const user = await this.prisma.$transaction(
        async (tx) => {
          if ((await tx.user.count()) > 0) {
            throw new ConflictException('System bootstrap has already been completed');
          }
          return tx.user.create({
            data: {
              email: dto.email.trim().toLowerCase(),
              fullName: dto.fullName.trim(),
              passwordHash: await hashPassword(dto.password),
              roleAssignments: {
                create: { role: { connect: { code: 'SYSTEM_ADMIN' } } },
              },
            },
            select: { id: true, email: true, fullName: true, isActive: true },
          });
        },
        { isolationLevel: 'Serializable' },
      );
      return user;
    } catch (error: any) {
      if (error?.code === 'P2034') {
        throw new ConflictException('System bootstrap has already been completed');
      }
      if (error?.code === 'P2002') {
        throw new ConflictException('An account with this email already exists');
      }
      throw error;
    }
  }

  async login(dto: LoginDto) {
    const email = dto.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, fullName: true, passwordHash: true, isActive: true },
    });

    if (!user || !user.isActive || !(await verifyPassword(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Email or password is incorrect');
    }

    const token = randomBytes(32).toString('base64url');
    const tokenHash = this.hashToken(token);
    const expiresAt = new Date(Date.now() + AUTH_SESSION_HOURS * 60 * 60 * 1000);
    await this.prisma.authSession.create({
      data: { userId: user.id, tokenHash, expiresAt },
    });

    return {
      accessToken: token,
      tokenType: 'Bearer',
      expiresAt,
      user: { id: user.id, email: user.email, fullName: user.fullName },
    };
  }

  async createEmployeeAccountInvite(
    dto: CreateEmployeeAccountInviteDto,
    user: AuthenticatedUser,
  ) {
    const person = await this.prisma.person.findUnique({
      where: { id: dto.personId },
      select: {
        id: true,
        personNumber: true,
        firstName: true,
        middleName: true,
        lastName: true,
        status: true,
        userAccount: { select: { id: true } },
        employments: {
          where: { status: 'ACTIVE' },
          select: { organizationId: true },
        },
      },
    });

    if (!person) throw new NotFoundException('Person not found');
    if (person.status !== 'ACTIVE' || !person.employments.length) {
      throw new ConflictException(
        'An employee account can only be invited for an active employee',
      );
    }
    if (person.userAccount) {
      throw new ConflictException('This employee already has a portal account');
    }
    for (const employment of person.employments) {
      const granted =
        user.globalPermissionCodes.includes('employeeAccounts.invite') ||
        user.organizationPermissions[employment.organizationId]?.includes(
          'employeeAccounts.invite',
        );
      if (!granted) {
        throw new ForbiddenException(
          'You do not have access to invite this employee',
        );
      }
    }

    const activationToken = randomBytes(32).toString('base64url');
    const tokenHash = this.hashToken(activationToken);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 72 * 60 * 60 * 1000);

    const invitation = await this.prisma.$transaction(async (tx) => {
      await tx.employeeAccountInvite.updateMany({
        where: { personId: person.id, usedAt: null },
        data: { usedAt: now },
      });
      return tx.employeeAccountInvite.create({
        data: {
          personId: person.id,
          tokenHash,
          expiresAt,
          createdByUserId: user.id,
        },
        select: { id: true, expiresAt: true },
      });
    });

    return {
      id: invitation.id,
      personNumber: person.personNumber,
      employeeName: [person.firstName, person.middleName, person.lastName]
        .filter(Boolean)
        .join(' '),
      activationToken,
      expiresAt: invitation.expiresAt,
    };
  }

  async registerEmployeeAccount(dto: RegisterEmployeeAccountDto) {
    const tokenHash = this.hashToken(dto.activationToken);
    const now = new Date();
    const email = dto.email.trim().toLowerCase();
    const passwordHash = await hashPassword(dto.password);
    const accessToken = randomBytes(32).toString('base64url');
    const sessionTokenHash = this.hashToken(accessToken);
    const sessionExpiresAt = new Date(
      now.getTime() + AUTH_SESSION_HOURS * 60 * 60 * 1000,
    );

    try {
      return await this.prisma.$transaction(
        async (tx) => {
          const invitation = await tx.employeeAccountInvite.findUnique({
            where: { tokenHash },
            include: {
              person: {
                select: {
                  id: true,
                  firstName: true,
                  middleName: true,
                  lastName: true,
                  status: true,
                  userAccount: { select: { id: true } },
                },
              },
            },
          });

          if (
            !invitation ||
            invitation.usedAt ||
            invitation.expiresAt <= now ||
            invitation.person.status !== 'ACTIVE' ||
            invitation.person.userAccount
          ) {
            throw new UnauthorizedException(
              'This activation link is invalid, expired, or already used',
            );
          }

          const claimed = await tx.employeeAccountInvite.updateMany({
            where: {
              id: invitation.id,
              usedAt: null,
              expiresAt: { gt: now },
            },
            data: { usedAt: now },
          });
          if (claimed.count !== 1) {
            throw new UnauthorizedException(
              'This activation link is invalid, expired, or already used',
            );
          }

          const fullName = [
            invitation.person.firstName,
            invitation.person.middleName,
            invitation.person.lastName,
          ]
            .filter(Boolean)
            .join(' ');
          const account = await tx.user.create({
            data: {
              personId: invitation.person.id,
              email,
              fullName,
              passwordHash,
            },
            select: { id: true, email: true, fullName: true, personId: true },
          });

          await tx.authSession.create({
            data: {
              userId: account.id,
              tokenHash: sessionTokenHash,
              expiresAt: sessionExpiresAt,
            },
          });

          return {
            accessToken,
            tokenType: 'Bearer',
            expiresAt: sessionExpiresAt,
            user: {
              id: account.id,
              email: account.email,
              fullName: account.fullName,
              employeeAccount: true,
            },
          };
        },
        { isolationLevel: 'Serializable' },
      );
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new ConflictException(
          'An account with this email already exists or this employee already has an account',
        );
      }
      if (error?.code === 'P2034') {
        throw new ConflictException(
          'This activation link was used at the same time; request a new link if needed',
        );
      }
      throw error;
    }
  }

  async employeePortal(user: AuthenticatedUser) {
    if (!user.personId) {
      throw new ForbiddenException('This account is not linked to an employee record');
    }

    const person = await this.prisma.person.findUnique({
      where: { id: user.personId },
      select: {
        id: true,
        personNumber: true,
        firstName: true,
        middleName: true,
        lastName: true,
        dateOfBirth: true,
        status: true,
        employments: {
          orderBy: { startDate: 'desc' },
          include: {
            organization: {
              select: { id: true, code: true, name: true, type: true },
            },
            department: { select: { id: true, code: true, name: true } },
            station: { select: { id: true, code: true, name: true } },
            positionAssignments: {
              orderBy: { effectiveFrom: 'desc' },
              include: {
                position: {
                  include: {
                    framework: {
                      select: { id: true, code: true, name: true, type: true },
                    },
                    level: {
                      select: {
                        id: true,
                        code: true,
                        title: true,
                        levelOrder: true,
                      },
                    },
                  },
                },
              },
            },
            postings: {
              orderBy: { effectiveFrom: 'desc' },
              include: {
                organization: { select: { id: true, code: true, name: true } },
                department: { select: { id: true, code: true, name: true } },
                station: { select: { id: true, code: true, name: true } },
              },
            },
            compensationAssignments: {
              orderBy: { effectiveFrom: 'desc' },
              include: {
                compensationStep: {
                  include: {
                    jobLevel: {
                      select: {
                        id: true,
                        code: true,
                        title: true,
                        levelOrder: true,
                      },
                    },
                    compensationScale: {
                      select: {
                        id: true,
                        code: true,
                        name: true,
                        currency: true,
                        isProvisional: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!person) throw new NotFoundException('Employee record not found');
    return { person, email: user.email };
  }

  async createUser(dto: CreateUserDto) {
    const assignments = await this.resolveRoleAssignments(dto.roles);

    try {
      return await this.prisma.user.create({
        data: {
          email: dto.email.trim().toLowerCase(),
          fullName: dto.fullName.trim(),
          passwordHash: await hashPassword(dto.password),
          roleAssignments: { create: assignments },
        },
        select: {
          id: true,
          email: true,
          fullName: true,
          isActive: true,
          createdAt: true,
          roleAssignments: {
            select: {
              organizationId: true,
              organization: { select: { code: true, name: true } },
              role: { select: { code: true, name: true } },
            },
          },
        },
      });
    } catch (error: any) {
      if (error?.code === 'P2002') {
        throw new ConflictException('An account with this email already exists');
      }
      throw error;
    }
  }

  async findUsers() {
    const users = await this.prisma.user.findMany({
      orderBy: { email: 'asc' },
      select: {
        id: true,
        email: true,
        fullName: true,
        isActive: true,
        createdAt: true,
        personId: true,
        person: {
          select: {
            personNumber: true,
            firstName: true,
            middleName: true,
            lastName: true,
            status: true,
          },
        },
        sessions: {
          where: { revokedAt: null, expiresAt: { gt: new Date() } },
          select: { id: true },
        },
        roleAssignments: {
          select: {
            organizationId: true,
            organization: { select: { code: true, name: true } },
            role: { select: { code: true, name: true } },
          },
        },
      },
    });
    return users.map(({ sessions, ...user }) => ({
      ...user,
      activeSessionCount: sessions.length,
      accountType: user.personId ? 'EMPLOYEE' : 'STAFF',
    }));
  }

  async updateUserRoles(id: string, dto: UpdateUserRolesDto, actor: AuthenticatedUser) {
    if (id === actor.id) {
      throw new ConflictException('Use another system administrator to change your own roles');
    }
    const assignments = await this.resolveRoleAssignments(dto.roles);

    const target = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        personId: true,
        roleAssignments: {
          select: { organizationId: true, role: { select: { code: true } } },
        },
      },
    });
    if (!target) throw new NotFoundException('User not found');
    if (target.personId) {
      throw new ConflictException('Employee portal accounts do not receive staff roles');
    }

    const wasSystemAdmin = target.roleAssignments.some(
      ({ role, organizationId }) => role.code === 'SYSTEM_ADMIN' && !organizationId,
    );
    const remainsSystemAdmin = dto.roles.some(
      ({ code, organizationId }) => code === 'SYSTEM_ADMIN' && !organizationId,
    );
    if (wasSystemAdmin && !remainsSystemAdmin) {
      const admins = await this.prisma.user.count({
        where: {
          roleAssignments: {
            some: { organizationId: null, role: { code: 'SYSTEM_ADMIN' } },
          },
        },
      });
      if (admins <= 1) {
        throw new ConflictException('The last system administrator cannot lose this role');
      }
    }

    return this.prisma.user.update({
      where: { id },
      data: {
        roleAssignments: {
          deleteMany: {},
          create: assignments,
        },
      },
      select: {
        id: true,
        email: true,
        fullName: true,
        roleAssignments: {
          select: {
            organizationId: true,
            organization: { select: { code: true, name: true } },
            role: { select: { code: true, name: true } },
          },
        },
      },
    });
  }

  async updateUserStatus(id: string, dto: UpdateUserStatusDto, actor: AuthenticatedUser) {
    if (id === actor.id && !dto.isActive) {
      throw new ConflictException('Use another system administrator to deactivate your own account');
    }
    const target = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        roleAssignments: {
          select: { organizationId: true, role: { select: { code: true } } },
        },
      },
    });
    if (!target) throw new NotFoundException('User not found');

    const isSystemAdmin = target.roleAssignments.some(
      ({ role, organizationId }) => role.code === 'SYSTEM_ADMIN' && !organizationId,
    );
    if (isSystemAdmin && !dto.isActive) {
      const activeAdmins = await this.prisma.user.count({
        where: {
          isActive: true,
          roleAssignments: {
            some: { organizationId: null, role: { code: 'SYSTEM_ADMIN' } },
          },
        },
      });
      if (activeAdmins <= 1) {
        throw new ConflictException('The last active system administrator cannot be deactivated');
      }
    }

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id },
        data: { isActive: dto.isActive },
        select: { id: true, email: true, fullName: true, isActive: true },
      });
      if (!dto.isActive) {
        await tx.authSession.updateMany({
          where: { userId: id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      return user;
    });
  }

  async revokeUserSessions(id: string) {
    const target = await this.prisma.user.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!target) throw new NotFoundException('User not found');
    const result = await this.prisma.authSession.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { userId: id, revokedSessionCount: result.count };
  }

  async updateMyProfile(dto: UpdateMyProfileDto, user: AuthenticatedUser) {
    const fullName = dto.fullName.trim();
    if (!fullName) throw new ConflictException('Full name cannot be empty');
    return this.prisma.user.update({
      where: { id: user.id },
      data: { fullName },
      select: { id: true, email: true, fullName: true },
    });
  }

  async changeMyPassword(dto: ChangePasswordDto, user: AuthenticatedUser) {
    const account = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { passwordHash: true },
    });
    if (!account || !(await verifyPassword(dto.currentPassword, account.passwordHash))) {
      throw new UnauthorizedException('Current password is incorrect');
    }
    if (dto.currentPassword === dto.newPassword) {
      throw new ConflictException('Choose a new password different from your current password');
    }
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: user.id },
        data: { passwordHash: await hashPassword(dto.newPassword) },
      });
      const revoked = await tx.authSession.updateMany({
        where: { userId: user.id, id: { not: user.sessionId }, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      return revoked.count;
    });
    return { success: true, otherSessionsRevoked: result };
  }

  async findRoles() {
    return this.prisma.role.findMany({
      orderBy: { code: 'asc' },
      select: {
        code: true,
        name: true,
        description: true,
        permissions: { select: { permission: { select: { code: true } } } },
      },
    });
  }

  private async resolveRoleAssignments(assignments: RoleAssignmentDto[]) {
    const uniqueAssignments = new Map<string, RoleAssignmentDto>();
    for (const assignment of assignments) {
      const scopeId = assignment.organizationId ?? '';
      const key = `${assignment.code}:${scopeId}`;
      if (uniqueAssignments.has(key)) {
        throw new ConflictException('Duplicate role assignment');
      }
      uniqueAssignments.set(key, assignment);
    }

    const roleCodes = [...new Set(assignments.map(({ code }) => code))];
    const roles = await this.prisma.role.findMany({
      where: { code: { in: roleCodes } },
      select: { id: true, code: true },
    });
    if (roles.length !== roleCodes.length) {
      throw new NotFoundException('One or more requested roles do not exist');
    }
    const roleByCode = new Map(roles.map((role) => [role.code, role.id]));

    const orgIds = [...new Set(
      [...uniqueAssignments.values()]
        .map(({ organizationId }) => organizationId)
        .filter((id): id is string => Boolean(id)),
    )];
    const organizations = orgIds.length
      ? await this.prisma.organization.findMany({
          where: { id: { in: orgIds } },
          select: { id: true, status: true },
        })
      : [];
    if (organizations.length !== orgIds.length) {
      throw new NotFoundException('One or more assigned organizations do not exist');
    }
    if (organizations.some(({ status }) => status !== 'ACTIVE')) {
      throw new ConflictException('Roles cannot be assigned to inactive organizations');
    }

    return [...uniqueAssignments.values()].map((assignment) => {
      if (assignment.code === 'SYSTEM_ADMIN' && assignment.organizationId) {
        throw new ConflictException('System Administrator must be a global role');
      }
      if (assignment.code !== 'SYSTEM_ADMIN' && !assignment.organizationId) {
        throw new ConflictException(
          'This role must be assigned to an organization',
        );
      }
      return {
        roleId: roleByCode.get(assignment.code)!,
        organizationId: assignment.organizationId,
      };
    });
  }

  async currentUser(user: AuthenticatedUser) {
    return {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      roles: user.roleCodes,
      permissions: user.permissionCodes,
      organizations: user.organizationIds,
      employeeAccount: Boolean(user.personId),
    };
  }

  async logout(user: AuthenticatedUser) {
    await this.prisma.authSession.updateMany({
      where: { id: user.sessionId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { success: true };
  }

  hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private constantTimeEquals(input: string, expected: string) {
    const inputBytes = Buffer.from(input);
    const expectedBytes = Buffer.from(expected);
    return inputBytes.length === expectedBytes.length && timingSafeEqual(inputBytes, expectedBytes);
  }
}
