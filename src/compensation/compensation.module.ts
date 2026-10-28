import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { CompensationController } from './compensation.controller';
import { CompensationService } from './compensation.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [CompensationController],
  providers: [CompensationService],
})
export class CompensationModule {}
