import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker.module';

// createApplicationContext, not create. A worker has nothing to serve, so it
// boots the container and the schedulers without opening a port. Binding one
// would only give the box something else to expose
async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerModule);

  // Same reason as the api: without this the Prisma pool and the Redis
  // connection leak on every restart
  app.enableShutdownHooks();

  new Logger('Worker').log('worker is up');
}
void bootstrap();
