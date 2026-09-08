import { Module } from '@nestjs/common';
import { HealthModule } from '@app/shared';
import { AuthModule } from '../auth/auth.module';
import { RatesModule } from '../rates/rates.module';
import { SearchModule } from '../search/search.module';
import { HealthController } from './health.controller';
import { StatusController } from './status.controller';
import { SystemHealthService } from './system-health.service';

@Module({
  imports: [AuthModule, HealthModule, RatesModule, SearchModule],
  controllers: [HealthController, StatusController],
  providers: [SystemHealthService],
})
export class StatusModule {}
