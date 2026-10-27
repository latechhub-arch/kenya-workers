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
import { AuthService } from './auth.service';
import { CreateBootstrapDto } from './create-bootstrap.dto';
import { CreateUserDto } from './create-user.dto';
import { LoginDto } from './login.dto';
import { PermissionsGuard } from './permissions.guard';
import { RequirePermissions } from './require-permissions.decorator';
import { SessionAuthGuard } from './session-auth.guard';
import { UpdateUserRolesDto } from './update-user-roles.dto';
import { UpdateUserStatusDto } from './update-user-status.dto';
import type { AuthenticatedRequest } from './auth.types';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('bootstrap')
  bootstrap(@Body() dto: CreateBootstrapDto) {
    return this.authService.bootstrap(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @UseGuards(SessionAuthGuard)
  @Get('me')
  me(@Req() request: AuthenticatedRequest) {
    return this.authService.currentUser(request.user);
  }

  @UseGuards(SessionAuthGuard)
  @Post('logout')
  logout(@Req() request: AuthenticatedRequest) {
    return this.authService.logout(request.user);
  }

  @UseGuards(SessionAuthGuard, PermissionsGuard)
  @RequirePermissions('users.read')
  @Get('users')
  findUsers() {
    return this.authService.findUsers();
  }

  @UseGuards(SessionAuthGuard, PermissionsGuard)
  @RequirePermissions('users.create')
  @Post('users')
  createUser(@Body() dto: CreateUserDto) {
    return this.authService.createUser(dto);
  }

  @UseGuards(SessionAuthGuard, PermissionsGuard)
  @RequirePermissions('users.manage')
  @Patch('users/:id/roles')
  updateUserRoles(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateUserRolesDto,
  ) {
    return this.authService.updateUserRoles(id, dto);
  }

  @UseGuards(SessionAuthGuard, PermissionsGuard)
  @RequirePermissions('users.manage')
  @Patch('users/:id/status')
  updateUserStatus(
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() dto: UpdateUserStatusDto,
  ) {
    return this.authService.updateUserStatus(id, dto);
  }

  @UseGuards(SessionAuthGuard, PermissionsGuard)
  @RequirePermissions('users.manage')
  @Get('roles')
  findRoles() {
    return this.authService.findRoles();
  }
}
