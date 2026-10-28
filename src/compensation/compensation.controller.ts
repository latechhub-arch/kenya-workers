import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { CompensationQueryDto } from './compensation-query.dto';
import { CompensationService } from './compensation.service';
import { CreateCompensationScaleDto } from './create-compensation-scale.dto';
import { CloseCompensationScaleDto } from './close-compensation-scale.dto';

@Controller('compensation-scales')
@UseGuards(SessionAuthGuard, PermissionsGuard)
export class CompensationController {
  constructor(private readonly compensationService: CompensationService) {}

  @Get()
  @RequirePermissions('compensation.read')
  findAll(
    @Query() query: CompensationQueryDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.compensationService.findAll(query, request.user);
  }

  @Post()
  @RequirePermissions('compensation.create')
  create(
    @Body() dto: CreateCompensationScaleDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.compensationService.create(dto, request.user);
  }

  @Patch(':id/close')
  @RequirePermissions('compensation.update')
  close(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: CloseCompensationScaleDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.compensationService.close(id, dto, request.user);
  }
}
