import 'dotenv/config';
import { defineConfig } from 'prisma/config';

// A second config beside the gateway's, selected with --config. Its paths are
// relative to this file, while dotenv still reads the .env at the backend root
// because that is where the CLI runs from
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env['NOTIFICATIONS_DATABASE_URL'],
  },
});
