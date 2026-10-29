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
import { SessionAuthGuard } from '../auth/session-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { ClosePayComponentDto } from './close-pay-component.dto';
import { CreatePayComponentDto } from './create-pay-component.dto';
import { CreatePayslipDto } from './create-payslip.dto';
import { PayrollService } from './payroll.service';

@Controller('payroll')
@UseGuards(SessionAuthGuard, PermissionsGuard)
export class PayrollController {
  constructor(private readonly payrollService: PayrollService) {}

  @Get('me/payslips')
  @RequirePermissions('payroll.self.read')
  findMyPayslips(
    @Query('year') year: string | undefined,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.payrollService.findMyPayslips(year, request.user);
  }

  @Get('employments/:employmentId/components')
  @RequirePermissions('payroll.read')
  findComponents(
    @Param('employmentId', new ParseUUIDPipe()) employmentId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.payrollService.findComponents(employmentId, request.user);
  }

  @Post('employments/:employmentId/components')
  @RequirePermissions('payroll.manage')
  createComponent(
    @Param('employmentId', new ParseUUIDPipe()) employmentId: string,
    @Body() dto: CreatePayComponentDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.payrollService.createComponent(employmentId, dto, request.user);
  }

  @Patch('components/:id/close')
  @RequirePermissions('payroll.manage')
  closeComponent(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: ClosePayComponentDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.payrollService.closeComponent(id, dto, request.user);
  }

  @Get('employments/:employmentId/payslips')
  @RequirePermissions('payroll.read')
  findEmploymentPayslips(
    @Param('employmentId', new ParseUUIDPipe()) employmentId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.payrollService.findEmploymentPayslips(employmentId, request.user);
  }

  @Post('employments/:employmentId/payslips')
  @RequirePermissions('payroll.manage')
  createPayslip(
    @Param('employmentId', new ParseUUIDPipe()) employmentId: string,
    @Body() dto: CreatePayslipDto,
    @Req() request: AuthenticatedRequest,
  ) {
    return this.payrollService.createPayslip(employmentId, dto, request.user);
  }
}
