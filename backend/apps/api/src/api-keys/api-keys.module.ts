import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DashboardApiKeysController } from './dashboard-api-keys.controller';
import { ApiKeysService } from './api-keys.service';

@Module({
  imports: [AuthModule],
  controllers: [DashboardApiKeysController],
  providers: [ApiKeysService],
})
export class ApiKeysModule {}
