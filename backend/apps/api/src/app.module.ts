import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { OriginGuard } from './auth/guards/origin.guard';
import { PrismaModule, QueueModule } from '@app/shared';
import { PaymentsModule } from './payments/payments.module';
import { PingModule } from './ping/ping.module';
import { RatesModule } from './rates/rates.module';
import { WebhooksModule } from './webhooks/webhooks.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }]),
    PrismaModule,
    QueueModule,
    AuthModule,
    PingModule,
    RatesModule,
    PaymentsModule,
    WebhooksModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_GUARD, useClass: OriginGuard }],
})
export class AppModule {}
