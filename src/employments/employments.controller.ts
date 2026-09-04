import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { CreateEmploymentDto } from './create-employment.dto';
import { EmploymentsService } from './employments.service';
import { UpdateEmploymentStatusDto } from './update-employment-status.dto';

@Controller('employments')
export class EmploymentsController {
  constructor(
    private readonly employmentsService: EmploymentsService,
  ) {}

  @Get()
  async findAll() {
    return this.employmentsService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.employmentsService.findOne(id);
  }

  @Post()
  async create(@Body() dto: CreateEmploymentDto) {
    return this.employmentsService.create(dto);
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateEmploymentStatusDto,
  ) {
    return this.employmentsService.updateStatus(id, dto);
  }
}
