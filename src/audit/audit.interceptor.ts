import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Observable, mergeMap } from 'rxjs';
import { AuthenticatedRequest } from '../auth/auth.types';
import { AuditService } from './audit.service';

const SENSITIVE_FIELDS = new Set([
  'password',
  'passwordhash',
  'bootstrapsecret',
  'secret',
  'token',
  'accesstoken',
  'refreshtoken',
  'authorization',
]);

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const method = request.method.toUpperCase();
    if (!request.user || !['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return next.handle();
    }

    const routePath = `${request.baseUrl ?? ''}${request.route?.path ?? request.path}`;
    if (routePath === '/auth/login' || routePath === '/auth/bootstrap') {
      return next.handle();
    }

    return next.handle().pipe(
      mergeMap(async (result: unknown) => {
        try {
          await this.auditService.record(
            this.toAuditEvent(request, method, routePath, result),
          );
        } catch (error) {
          // A logging failure must not turn an already-committed business change into a false API failure.
          this.logger.error('Could not persist an audit event', error);
        }
        return result;
      }),
    );
  }

  private toAuditEvent(
    request: AuthenticatedRequest,
    method: string,
    routePath: string,
    result: unknown,
  ) {
    const response = this.asRecord(result);
    const nestedRecord =
      this.asRecord(response?.posting) ??
      this.asRecord(response?.assignment) ??
      response;
    const body = this.asRecord(request.body) ?? {};
    const entityType = this.entityType(routePath);
    const organizationId = this.firstString(
      response?.organizationId,
      response?.organization && this.asRecord(response.organization)?.id,
      response?.position && this.asRecord(response.position)?.organizationId,
      response?.posting && this.asRecord(response.posting)?.organizationId,
      response?.employment &&
        this.asRecord(response.employment)?.organizationId,
      response?.framework && this.asRecord(response.framework)?.organizationId,
      response?.framework &&
        this.asRecord(this.asRecord(response.framework)?.organization)?.id,
      body.organizationId,
      entityType === 'organization' ? response?.id : undefined,
    );
    const changedFields = Object.keys(body).filter(
      (field) => !SENSITIVE_FIELDS.has(field.toLowerCase()),
    );
    const metadata: Record<string, string | string[]> = { changedFields };
    for (const field of ['effectiveFrom', 'effectiveDate']) {
      if (typeof body[field] === 'string') metadata[field] = body[field];
    }

    const userAgent = request.get('user-agent');
    return {
      actorUserId: request.user.id,
      action: `${method} ${routePath}`.slice(0, 150),
      entityType,
      entityId: this.firstString(nestedRecord?.id, request.params?.id),
      organizationId: this.validUuid(organizationId),
      metadata: metadata as Prisma.InputJsonValue,
      ipAddress: request.ip?.slice(0, 64),
      userAgent: userAgent?.slice(0, 500),
    };
  }

  private entityType(routePath: string) {
    const route = routePath.toLowerCase();
    if (route.includes('/employments/') && route.endsWith('/positions')) {
      return 'employment_position_assignment';
    }
    if (route.includes('/employments/') && route.endsWith('/compensation')) {
      return 'employment_compensation_assignment';
    }
    if (route.includes('/employments/') && route.endsWith('/postings')) {
      return 'employment_posting';
    }
    if (route.includes('/auth/users/') && route.endsWith('/roles'))
      return 'user_role';
    if (route.startsWith('/auth/users')) return 'user';
    if (route.startsWith('/job-frameworks/') && route.endsWith('/levels'))
      return 'job_level';

    const resource = route.split('/').filter(Boolean)[0] ?? 'resource';
    const names: Record<string, string> = {
      'audit-events': 'audit_event',
      'job-frameworks': 'job_framework',
      'compensation-scales': 'compensation_scale',
      positions: 'job_position',
      organizations: 'organization',
      departments: 'department',
      stations: 'station',
      persons: 'person',
      employments: 'employment',
    };
    return names[resource] ?? 'api_resource';
  }

  private asRecord(value: unknown): Record<string, any> | undefined {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, any>)
      : undefined;
  }

  private firstString(...values: unknown[]) {
    return values.find((value): value is string => typeof value === 'string');
  }

  private validUuid(value?: string) {
    return value &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        value,
      )
      ? value
      : undefined;
  }
}
