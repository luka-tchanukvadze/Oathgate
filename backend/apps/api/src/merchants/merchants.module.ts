import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { DashboardMerchantsController } from './dashboard-merchants.controller';

@Module({
  imports: [AuthModule],
  controllers: [DashboardMerchantsController],
})
export class MerchantsModule {}
