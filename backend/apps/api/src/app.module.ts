import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ApiKeysModule } from './api-keys/api-keys.module';
import { AuthModule } from './auth/auth.module';
import { CheckoutModule } from './checkout/checkout.module';
import { DashboardLedgerModule } from './ledger/ledger.module';
import { OriginGuard } from './auth/guards/origin.guard';
import { PrismaModule, QueueModule } from '@app/shared';
import { MerchantsModule } from './merchants/merchants.module';
import { PaymentsModule } from './payments/payments.module';
import { PingModule } from './ping/ping.module';
import { SandboxModule } from './sandbox/sandbox.module';
import { RatesModule } from './rates/rates.module';
import { WebhooksModule } from './webhooks/webhooks.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // Sixty a minute per address, and the login route asks for far less
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    PrismaModule,
    QueueModule,
    AuthModule,
    ApiKeysModule,
    MerchantsModule,
    CheckoutModule,
    DashboardLedgerModule,
    SandboxModule,
    PingModule,
    RatesModule,
    PaymentsModule,
    WebhooksModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    // Counted before anything else runs, so a flood is cheap to refuse
    // Registering the module alone does nothing: without this the limit only
    // applies where a route names the guard itself
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: OriginGuard },
  ],
})
export class AppModule {}
