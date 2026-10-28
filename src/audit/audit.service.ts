import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  assertOrganizationPermission,
  organizationIdsForPermission,
} from '../auth/organization-access';
import { AuthenticatedUser } from '../auth/auth.types';
import { AuditQueryDto } from './audit-query.dto';

export interface CreateAuditEvent {
  actorUserId: string;
  action: string;
  entityType: string;
  entityId?: string;
  organizationId?: string;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  record(event: CreateAuditEvent) {
    return this.prisma.auditEvent.create({
      data: {
        actorUserId: event.actorUserId,
        action: event.action,
        entityType: event.entityType,
        entityId: event.entityId,
        organizationId: event.organizationId,
        metadata: event.metadata,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
      },
      select: { id: true },
    });
  }

  findAll(query: AuditQueryDto, user: AuthenticatedUser) {
    const organizationIds = organizationIdsForPermission(user, 'audit.read');
    if (query.organizationId) {
      assertOrganizationPermission(user, query.organizationId, 'audit.read');
    }

    const from = query.from ? new Date(query.from) : undefined;
    const to = query.to ? new Date(query.to) : undefined;
    if (from && to && from > to) {
      throw new BadRequestException(
        'The from date must be earlier than or equal to the to date',
      );
    }

    return this.prisma.auditEvent.findMany({
      where: {
        ...(organizationIds ? { organizationId: { in: organizationIds } } : {}),
        ...(query.organizationId
          ? { organizationId: query.organizationId }
          : {}),
        ...(query.actorUserId ? { actorUserId: query.actorUserId } : {}),
        ...(query.entityType ? { entityType: query.entityType } : {}),
        ...(query.action
          ? { action: { contains: query.action, mode: 'insensitive' } }
          : {}),
        ...(from || to
          ? {
              occurredAt: {
                ...(from ? { gte: from } : {}),
                ...(to ? { lte: to } : {}),
              },
            }
          : {}),
      },
      orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
      take: query.limit ?? 50,
      include: {
        actorUser: { select: { id: true, email: true, fullName: true } },
        organization: { select: { id: true, code: true, name: true } },
      },
    });
  }
}
