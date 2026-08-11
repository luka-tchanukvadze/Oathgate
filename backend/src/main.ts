import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');

  // Nest only fires onModuleDestroy on SIGINT and SIGTERM if I ask it to, and
  // without that the Prisma pool leaks on every restart
  app.enableShutdownHooks();

  const port = process.env.PORT ?? 5002;
  await app.listen(port);

  new Logger('Bootstrap').log(`listening on port ${port}`);
}
bootstrap();
