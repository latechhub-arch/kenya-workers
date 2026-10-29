import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PayrollController } from './payroll.controller';
import { PayrollService } from './payroll.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [PayrollController],
  providers: [PayrollService],
})
export class PayrollModule {}
