import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';

// createApplicationContext, not create
// A worker serves nothing, so it boots without opening a port
async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerModule);

  // Without this the Prisma pool and the Redis connection leak on restart
  app.enableShutdownHooks();

  new Logger('Worker').log('worker is up');
}
void bootstrap();
