import { Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { PersonsModule } from './persons/persons.module';
import { EmploymentsModule } from './employments/employments.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { DepartmentsModule } from './departments/departments.module';
import { StationsModule } from './stations/stations.module';
import { JobStructuresModule } from './job-structures/job-structures.module';
import { AuthModule } from './auth/auth.module';
import { AuditModule } from './audit/audit.module';
import { AuditInterceptor } from './audit/audit.interceptor';
import { CompensationModule } from './compensation/compensation.module';
import { AttendanceModule } from './attendance/attendance.module';
import { PayrollModule } from './payroll/payroll.module';

@Module({
  imports: [
    PrismaModule,
    PersonsModule,
    EmploymentsModule,
    OrganizationsModule,
    DepartmentsModule,
    StationsModule,
    JobStructuresModule,
    AuthModule,
    AuditModule,
    CompensationModule,
    AttendanceModule,
    PayrollModule,
  ],
  providers: [{ provide: APP_INTERCEPTOR, useClass: AuditInterceptor }],
})
export class AppModule {}
