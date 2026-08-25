import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // One prefix for both /v1 and /dashboard
  // A reverse proxy can then hand /api to me and the rest to the dashboard
  app.setGlobalPrefix('api');

  app.use(cookieParser());

  // forbidNonWhitelisted makes an unexpected field a 400, not a silent drop
  // On a payments API I would rather reject than guess
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // credentials, or the browser never sends the session cookie
  // The origin has to be an explicit list for that to be allowed
  app.enableCors({
    origin: process.env.DASHBOARD_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  });

  // Nest only fires onModuleDestroy on SIGINT and SIGTERM if I ask
  // Without it the Prisma pool leaks on every restart
  app.enableShutdownHooks();

  const port = process.env.PORT ?? 5002;
  await app.listen(port);

  new Logger('Bootstrap').log(`listening on port ${port}`);
}
void bootstrap();
