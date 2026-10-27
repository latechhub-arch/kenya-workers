import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { EmploymentsController } from './employments.controller';
import { EmploymentsService } from './employments.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [EmploymentsController],
  providers: [EmploymentsService],
})
export class EmploymentsModule {}
