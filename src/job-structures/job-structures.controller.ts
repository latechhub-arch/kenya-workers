import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { CreateJobFrameworkDto } from './create-job-framework.dto';
import { CreateJobLevelDto } from './create-job-level.dto';
import { CreateJobLevelAliasDto } from './create-job-level-alias.dto';
import { CreateJobPositionDto } from './create-job-position.dto';
import { JobStructuresService } from './job-structures.service';

@Controller()
@UseGuards(SessionAuthGuard, PermissionsGuard)
export class JobStructuresController {
  constructor(private readonly jobStructuresService: JobStructuresService) {}

  @Get('job-frameworks')
  @RequirePermissions('jobFrameworks.read')
  findFrameworks(@Req() request: AuthenticatedRequest) {
    return this.jobStructuresService.findFrameworks(request.user);
  }

  @Post('job-frameworks')
  @RequirePermissions('jobFrameworks.create')
  createFramework(@Body() dto: CreateJobFrameworkDto, @Req() request: AuthenticatedRequest) {
    return this.jobStructuresService.createFramework(dto, request.user);
  }

  @Get('job-frameworks/:id/levels')
  @RequirePermissions('jobLevels.read')
  findLevels(@Param('id', new ParseUUIDPipe()) id: string, @Req() request: AuthenticatedRequest) {
    return this.jobStructuresService.findLevels(id, request.user);
  }

  @Post('job-frameworks/:id/levels')
  @RequirePermissions('jobLevels.create')
  createLevel(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CreateJobLevelDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.jobStructuresService.createLevel(id, dto, request.user);
  }

  @Post('job-frameworks/:frameworkId/levels/:levelId/aliases')
  @RequirePermissions('jobLevels.create')
  createLevelAlias(
    @Param('frameworkId', new ParseUUIDPipe()) frameworkId: string,
    @Param('levelId', new ParseUUIDPipe()) levelId: string,
    @Body() dto: CreateJobLevelAliasDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.jobStructuresService.createLevelAlias(
      frameworkId,
      levelId,
      dto,
      request.user,
    );
  }

  @Get('positions')
  @RequirePermissions('positions.read')
  findPositions(@Req() request: AuthenticatedRequest) {
    return this.jobStructuresService.findPositions(request.user);
  }

  @Post('positions')
  @RequirePermissions('positions.create')
  createPosition(@Body() dto: CreateJobPositionDto, @Req() request: AuthenticatedRequest) {
    return this.jobStructuresService.createPosition(dto, request.user);
  }
}
