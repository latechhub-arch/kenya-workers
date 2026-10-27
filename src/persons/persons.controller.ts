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
import { CreatePersonDto } from './create-person.dto';
import { UpdatePersonStatusDto } from './update-person-status.dto';
import { PersonsService } from './persons.service';

@Controller('persons')
@UseGuards(SessionAuthGuard, PermissionsGuard)
export class PersonsController {
  constructor(private readonly personsService: PersonsService) {}

  @Get()
  @RequirePermissions('persons.read')
  async findAll(@Req() request: AuthenticatedRequest) {
    return this.personsService.findAll(request.user);
  }

  @Get(':id')
  @RequirePermissions('persons.read')
  async findOne(@Param('id', new ParseUUIDPipe()) id: string, @Req() request: AuthenticatedRequest) {
    return this.personsService.findOne(id, request.user);
  }

  @Post()
  @RequirePermissions('persons.create')
  async create(@Body() dto: CreatePersonDto, @Req() request: AuthenticatedRequest) {
    return this.personsService.create(dto, request.user);
  }

  @Patch(':id/status')
  @RequirePermissions('persons.status.update')
  async updateStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdatePersonStatusDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.personsService.updateStatus(id, dto, request.user);
  }
}
