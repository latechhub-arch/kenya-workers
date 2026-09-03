import { Module } from '@nestjs/common';
import { PrismaModule } from './prisma/prisma.module';
import { PersonsModule } from './persons/persons.module';

@Module({
  imports: [PrismaModule, PersonsModule],
})
export class AppModule {}
