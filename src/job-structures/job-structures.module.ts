import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { JobStructuresController } from './job-structures.controller';
import { JobStructuresService } from './job-structures.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [JobStructuresController],
  providers: [JobStructuresService],
})
export class JobStructuresModule {}
