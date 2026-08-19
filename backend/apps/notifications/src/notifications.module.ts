import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

// Deliberately does not import PrismaModule. This service is going to own its
// own database, and the whole point of the boundary is that it cannot reach
// into the gateway's tables even by accident
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
})
export class NotificationsModule {}
