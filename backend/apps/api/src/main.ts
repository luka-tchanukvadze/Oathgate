import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // One hop, because there is exactly one proxy in front of me
  // Without this every request looks like it came from the proxy, and the five
  // logins a minute limit becomes five a minute for the whole internet at once
  // A larger number would let a caller forge the header and pick their own ip
  app.set('trust proxy', 1);

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
  // Split, so a second origin is a comma rather than one long string nothing
  // will ever match
  app.enableCors({
    origin: (process.env.DASHBOARD_ORIGIN ?? 'http://localhost:3000')
      .split(',')
      .map((origin) => origin.trim()),
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
