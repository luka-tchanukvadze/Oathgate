import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NotificationsModule } from './notifications.module';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(NotificationsModule);

  app.enableShutdownHooks();

  new Logger('Notifications').log('notifications is up');
}
void bootstrap();
