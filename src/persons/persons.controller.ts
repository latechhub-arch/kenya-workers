import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { CreatePersonDto } from './create-person.dto';
import { UpdatePersonStatusDto } from './update-person-status.dto';
import { PersonsService } from './persons.service';

@Controller('persons')
export class PersonsController {
  constructor(private readonly personsService: PersonsService) {}

  @Get()
  async findAll() {
    return this.personsService.findAll();
  }

  @Get(':id')
  async findOne(@Param('id', new ParseUUIDPipe()) id: string) {
    return this.personsService.findOne(id);
  }

  @Post()
  async create(@Body() dto: CreatePersonDto) {
    return this.personsService.create(dto);
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdatePersonStatusDto,
  ) {
    return this.personsService.updateStatus(id, dto);
  }
}