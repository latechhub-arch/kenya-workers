import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { CreateEmploymentDto } from './create-employment.dto';
import { CreateEmploymentCompensationAssignmentDto } from './create-employment-compensation-assignment.dto';
import { CreateEmploymentPositionAssignmentDto } from './create-employment-position-assignment.dto';
import { CreateEmploymentPostingDto } from './create-employment-posting.dto';
import { EmploymentsService } from './employments.service';
import { UpdateEmploymentStatusDto } from './update-employment-status.dto';

@Controller('employments')
@UseGuards(SessionAuthGuard, PermissionsGuard)
export class EmploymentsController {
  constructor(private readonly employmentsService: EmploymentsService) {}

  @Get()
  @RequirePermissions('employments.read')
  async findAll(@Req() request: AuthenticatedRequest) {
    return this.employmentsService.findAll(request.user);
  }

  @Get(':id/postings')
  @RequirePermissions('postings.read')
  async findPostings(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.employmentsService.findPostings(id, request.user);
  }

  @Get(':id/positions')
  @RequirePermissions('employmentPositions.read')
  findPositionAssignments(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.employmentsService.findPositionAssignments(id, request.user);
  }

  @Post(':id/positions')
  @RequirePermissions('employmentPositions.assign')
  createPositionAssignment(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CreateEmploymentPositionAssignmentDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.employmentsService.createPositionAssignment(
      id,
      dto,
      request.user,
    );
  }

  @Get(':id/compensation')
  @RequirePermissions('employmentCompensation.read')
  findCompensationAssignments(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.employmentsService.findCompensationAssignments(
      id,
      request.user,
    );
  }

  @Post(':id/compensation')
  @RequirePermissions('employmentCompensation.assign')
  createCompensationAssignment(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CreateEmploymentCompensationAssignmentDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.employmentsService.createCompensationAssignment(
      id,
      dto,
      request.user,
    );
  }

  @Get(':id/compensation/progression')
  @RequirePermissions('employmentCompensation.read')
  previewAnnualProgression(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.employmentsService.previewAnnualProgression(id, request.user);
  }

  @Post(':id/compensation/progression')
  @RequirePermissions('employmentCompensation.assign')
  applyAnnualProgression(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.employmentsService.applyAnnualProgression(id, request.user);
  }

  @Post(':id/postings')
  @RequirePermissions('postings.create')
  async createPosting(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CreateEmploymentPostingDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.employmentsService.createPosting(id, dto, request.user);
  }

  @Get(':id')
  @RequirePermissions('employments.read')
  async findOne(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.employmentsService.findOne(id, request.user);
  }

  @Post()
  @RequirePermissions('employments.create')
  async create(
    @Body() dto: CreateEmploymentDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.employmentsService.create(dto, request.user);
  }

  @Patch(':id/status')
  @RequirePermissions('employments.status.update')
  async updateStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateEmploymentStatusDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.employmentsService.updateStatus(id, dto, request.user);
  }
}
