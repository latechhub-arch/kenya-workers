import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';
import { AuthenticatedUser } from './auth.types';

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authService: AuthService,
  ) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<Request & { user?: AuthenticatedUser }>();
    const authorization = request.headers.authorization;
    const [scheme, token] = authorization?.split(' ') ?? [];
    if (scheme?.toLowerCase() !== 'bearer' || !token) {
      throw new UnauthorizedException('A valid bearer token is required');
    }

    const tokenHash = this.authService.hashToken(token);
    const session = await this.prisma.authSession.findUnique({
      where: { tokenHash },
      include: {
        user: {
          include: {
            roleAssignments: {
              include: {
                role: {
                  include: { permissions: { include: { permission: true } } },
                },
                organization: { select: { id: true } },
              },
            },
          },
        },
      },
    });

    if (!session || session.revokedAt || session.expiresAt <= new Date() || !session.user.isActive) {
      throw new UnauthorizedException('Session is invalid or expired');
    }

    const organizationGraph = await this.prisma.organization.findMany({
      select: { id: true, parentId: true },
    });
    const assignments = session.user.roleAssignments;
    const globalPermissionCodes = new Set<string>();
    const scopedRoots = new Map<string, Set<string>>();
    for (const assignment of assignments) {
      const permissionCodes = assignment.role.permissions.map(
        ({ permission }) => permission.code,
      );
      if (!assignment.organizationId) {
        permissionCodes.forEach((code) => globalPermissionCodes.add(code));
        continue;
      }
      const existing = scopedRoots.get(assignment.organizationId) ?? new Set<string>();
      permissionCodes.forEach((code) => existing.add(code));
      scopedRoots.set(assignment.organizationId, existing);
    }

    const organizationPermissions: Record<string, string[]> = {};
    for (const [rootId, codes] of scopedRoots) {
      const included = new Set([rootId]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const organization of organizationGraph) {
          if (organization.parentId && included.has(organization.parentId) && !included.has(organization.id)) {
            included.add(organization.id);
            changed = true;
          }
        }
      }
      for (const organizationId of included) {
        const permissions = new Set(organizationPermissions[organizationId] ?? []);
        codes.forEach((code) => permissions.add(code));
        organizationPermissions[organizationId] = [...permissions];
      }
    }
    const roles = assignments.map(({ role }) => role);
    const allPermissions = new Set(globalPermissionCodes);
    Object.values(organizationPermissions).flat().forEach((code) => allPermissions.add(code));
    request.user = {
      id: session.user.id,
      email: session.user.email,
      fullName: session.user.fullName,
      sessionId: session.id,
      tokenHash,
      roleCodes: roles.map(({ code }) => code),
      permissionCodes: [...allPermissions],
      globalPermissionCodes: [...globalPermissionCodes],
      organizationPermissions,
      organizationIds: Object.keys(organizationPermissions),
    };
    return true;
  }
}
