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
import { CreateDepartmentDto } from './create-department.dto';
import { DepartmentsService } from './departments.service';

@Controller('departments')
@UseGuards(SessionAuthGuard, PermissionsGuard)
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Get()
  @RequirePermissions('departments.read')
  async findAll(@Req() request: AuthenticatedRequest) {
    return this.departmentsService.findAll(request.user);
  }

  @Get(':id')
  @RequirePermissions('departments.read')
  async findOne(@Param('id', new ParseUUIDPipe()) id: string, @Req() request: AuthenticatedRequest) {
    return this.departmentsService.findOne(id, request.user);
  }

  @Post()
  @RequirePermissions('departments.create')
  async create(@Body() dto: CreateDepartmentDto, @Req() request: AuthenticatedRequest) {
    return this.departmentsService.create(dto, request.user);
  }
}
