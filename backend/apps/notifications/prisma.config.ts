import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// A second config beside the gateway's, picked with --config
// Run as: prisma migrate dev --config apps/notifications/prisma.config.ts
// Paths in here are relative to this file, not to where I run the command
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env['NOTIFICATIONS_DATABASE_URL'],
  },
});
