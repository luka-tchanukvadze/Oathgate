import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule, QueueModule } from '@app/shared';

// Empty of features on purpose. Step 1 only proves a second process can boot
// against the same database and the same Redis, and the crons and the queue
// consumer move over in step 2
@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    QueueModule,
  ],
})
export class WorkerModule {}
