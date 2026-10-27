import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PersonsController } from './persons.controller';
import { PersonsService } from './persons.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [PersonsController],
  providers: [PersonsService],
})
export class PersonsModule {}
