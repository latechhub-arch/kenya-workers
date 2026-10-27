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
import { CreateOrganizationDto } from './create-organization.dto';
import { OrganizationsService } from './organizations.service';
import { UpdateOrganizationStatusDto } from './update-organization-status.dto';

@Controller('organizations')
@UseGuards(SessionAuthGuard, PermissionsGuard)
export class OrganizationsController {
  constructor(
    private readonly organizationsService: OrganizationsService,
  ) {}

  @Get()
  @RequirePermissions('organizations.read')
  async findAll(@Req() request: AuthenticatedRequest) {
    return this.organizationsService.findAll(request.user);
  }

  @Get(':id')
  @RequirePermissions('organizations.read')
  async findOne(@Param('id', new ParseUUIDPipe()) id: string, @Req() request: AuthenticatedRequest) {
    return this.organizationsService.findOne(id, request.user);
  }

  @Post()
  @RequirePermissions('organizations.create')
  async create(@Body() dto: CreateOrganizationDto, @Req() request: AuthenticatedRequest) {
    return this.organizationsService.create(dto, request.user);
  }

  @Patch(':id/status')
  @RequirePermissions('organizations.status.update')
  async updateStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateOrganizationStatusDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.organizationsService.updateStatus(id, dto, request.user);
  }
}
