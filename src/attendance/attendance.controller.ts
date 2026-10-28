import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { SessionAuthGuard } from '../auth/session-auth.guard';
import type { AuthenticatedRequest } from '../auth/auth.types';
import { AttendanceService } from './attendance.service';
import { CheckInDto } from './check-in.dto';

@Controller('attendance/me')
@UseGuards(SessionAuthGuard)
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  @Get('today')
  getToday(@Req() request: AuthenticatedRequest) {
    return this.attendanceService.getToday(request.user);
  }

  @Post('check-in')
  checkIn(@Body() dto: CheckInDto, @Req() request: AuthenticatedRequest) {
    return this.attendanceService.checkIn(dto, request.user);
  }
}
