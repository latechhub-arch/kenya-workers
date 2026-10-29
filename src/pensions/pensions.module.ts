import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PensionsController } from './pensions.controller';
import { PensionsService } from './pensions.service';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [PensionsController],
  providers: [PensionsService],
})
export class PensionsModule {}
