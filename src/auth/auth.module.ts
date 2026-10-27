import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PermissionsGuard } from './permissions.guard';
import { SessionAuthGuard } from './session-auth.guard';

@Module({
  imports: [PrismaModule],
  controllers: [AuthController],
  providers: [AuthService, SessionAuthGuard, PermissionsGuard],
  exports: [AuthService, SessionAuthGuard, PermissionsGuard],
})
export class AuthModule {}
