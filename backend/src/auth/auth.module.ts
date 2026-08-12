import { Module } from '@nestjs/common';
import { ApiKeyGuard } from './guards/api-key.guard';
import { DashboardAuthController } from './dashboard-auth.controller';
import { SessionGuard } from './guards/session.guard';
import { SessionService } from './session.service';

@Module({
  controllers: [DashboardAuthController],
  providers: [ApiKeyGuard, SessionGuard, SessionService],
  exports: [ApiKeyGuard, SessionGuard, SessionService],
})
export class AuthModule {}
