import { Module } from '@nestjs/common';
import { SettlementModule } from '@app/shared';
import { AuthModule } from '../auth/auth.module';
import { PaymentsModule } from '../payments/payments.module';
import { WebhooksModule } from '../webhooks/webhooks.module';
import { SandboxController } from './sandbox.controller';
import { SandboxService } from './sandbox.service';

@Module({
  imports: [AuthModule, PaymentsModule, SettlementModule, WebhooksModule],
  controllers: [SandboxController],
  providers: [SandboxService],
})
export class SandboxModule {}
