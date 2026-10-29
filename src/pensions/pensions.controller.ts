import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import {
  ApprovePensionCaseDto,
  CreatePensionCaseDto,
  CreatePensionEvidenceDto,
  CreatePensionSchemeDto,
  RejectPensionCaseDto,
  ReportPensionerDeathDto,
  ReviewPensionCaseDto,
  ReviewPensionDeathDto,
  ReviewPensionEvidenceDto,
} from './pension.dto';
import { PensionsService } from './pensions.service';

@Controller('pensions')
@UseGuards(SessionAuthGuard, PermissionsGuard)
export class PensionsController {
  constructor(private readonly pensionsService: PensionsService) {}

  @Get('schemes')
  @RequirePermissions('pensions.read')
  findSchemes(@Req() request: AuthenticatedRequest) {
    return this.pensionsService.findSchemes(request.user);
  }

  @Post('schemes')
  @RequirePermissions('pensions.manage')
  createScheme(@Body() dto: CreatePensionSchemeDto, @Req() request: AuthenticatedRequest) {
    return this.pensionsService.createScheme(dto, request.user);
  }

  @Get('cases')
  @RequirePermissions('pensions.read')
  findCases(@Query('organizationId') organizationId: string | undefined, @Req() request: AuthenticatedRequest) {
    return this.pensionsService.findCases(organizationId, request.user);
  }

  @Post('cases')
  @RequirePermissions('pensions.create')
  createCase(@Body() dto: CreatePensionCaseDto, @Req() request: AuthenticatedRequest) {
    return this.pensionsService.createCase(dto, request.user);
  }

  @Get('cases/:id')
  @RequirePermissions('pensions.read')
  findCase(@Param('id', new ParseUUIDPipe()) id: string, @Req() request: AuthenticatedRequest) {
    return this.pensionsService.findCase(id, request.user);
  }

  @Post('cases/:id/evidence')
  @RequirePermissions('pensions.create')
  addEvidence(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: CreatePensionEvidenceDto, @Req() request: AuthenticatedRequest) {
    return this.pensionsService.addEvidence(id, dto, request.user);
  }

  @Post('cases/:id/evidence/:evidenceId/review')
  @RequirePermissions('pensions.review')
  reviewEvidence(@Param('id', new ParseUUIDPipe()) id: string, @Param('evidenceId', new ParseUUIDPipe()) evidenceId: string, @Body() dto: ReviewPensionEvidenceDto, @Req() request: AuthenticatedRequest) {
    return this.pensionsService.reviewEvidence(id, evidenceId, dto, request.user);
  }

  @Post('cases/:id/submit')
  @RequirePermissions('pensions.create')
  submitCase(@Param('id', new ParseUUIDPipe()) id: string, @Req() request: AuthenticatedRequest) {
    return this.pensionsService.submitCase(id, request.user);
  }

  @Post('cases/:id/review')
  @RequirePermissions('pensions.review')
  beginReview(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: ReviewPensionCaseDto, @Req() request: AuthenticatedRequest) {
    return this.pensionsService.beginReview(id, dto, request.user);
  }

  @Post('cases/:id/approve')
  @RequirePermissions('pensions.approve')
  approveCase(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: ApprovePensionCaseDto, @Req() request: AuthenticatedRequest) {
    return this.pensionsService.approveCase(id, dto, request.user);
  }

  @Post('cases/:id/reject')
  @RequirePermissions('pensions.approve')
  rejectCase(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: RejectPensionCaseDto, @Req() request: AuthenticatedRequest) {
    return this.pensionsService.rejectCase(id, dto, request.user);
  }

  @Post('cases/:id/death-report')
  @RequirePermissions('pensions.review')
  reportDeath(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: ReportPensionerDeathDto, @Req() request: AuthenticatedRequest) {
    return this.pensionsService.reportDeath(id, dto, request.user);
  }

  @Post('cases/:id/death-review')
  @RequirePermissions('pensions.death.review')
  reviewDeath(@Param('id', new ParseUUIDPipe()) id: string, @Body() dto: ReviewPensionDeathDto, @Req() request: AuthenticatedRequest) {
    return this.pensionsService.reviewDeath(id, dto, request.user);
  }
}
