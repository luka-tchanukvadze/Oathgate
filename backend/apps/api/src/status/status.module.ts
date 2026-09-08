import { Module } from '@nestjs/common';
import { HealthModule } from '@app/shared';
import { AuthModule } from '../auth/auth.module';
import { StatusController } from './status.controller';

@Module({
  imports: [AuthModule, HealthModule],
  controllers: [StatusController],
})
export class StatusModule {}
