import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { PersonsModule } from './persons/persons.module';
import { EmploymentsModule } from './employments/employments.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { DepartmentsModule } from './departments/departments.module';
import { StationsModule } from './stations/stations.module';
import { JobStructuresModule } from './job-structures/job-structures.module';
import { AuthModule } from './auth/auth.module';

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
  ],
})
export class AppModule {}
