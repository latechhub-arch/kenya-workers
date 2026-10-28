import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { AuditQueryDto } from './audit-query.dto';
import { AuditService } from './audit.service';

@Controller('audit-events')
@UseGuards(SessionAuthGuard, PermissionsGuard)
@RequirePermissions('audit.read')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  findAll(@Query() query: AuditQueryDto, @Req() request: AuthenticatedRequest) {
    return this.auditService.findAll(query, request.user);
  }
}
