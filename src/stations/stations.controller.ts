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
import { CreateStationDto } from './create-station.dto';
import { StationsService } from './stations.service';

@Controller('stations')
@UseGuards(SessionAuthGuard, PermissionsGuard)
export class StationsController {
  constructor(private readonly stationsService: StationsService) {}

  @Get()
  @RequirePermissions('stations.read')
  async findAll(@Req() request: AuthenticatedRequest) {
    return this.stationsService.findAll(request.user);
  }

  @Get(':id')
  @RequirePermissions('stations.read')
  async findOne(@Param('id', new ParseUUIDPipe()) id: string, @Req() request: AuthenticatedRequest) {
    return this.stationsService.findOne(id, request.user);
  }

  @Post()
  @RequirePermissions('stations.create')
  async create(@Body() dto: CreateStationDto, @Req() request: AuthenticatedRequest) {
    return this.stationsService.create(dto, request.user);
  }
}
