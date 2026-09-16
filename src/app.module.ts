import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { PersonsModule } from './persons/persons.module';
import { EmploymentsModule } from './employments/employments.module';
import { OrganizationsModule } from './organizations/organizations.module';
import { DepartmentsModule } from './departments/departments.module';

@Module({
  imports: [PrismaModule, PersonsModule, EmploymentsModule, OrganizationsModule, DepartmentsModule],
})
export class AppModule {}
