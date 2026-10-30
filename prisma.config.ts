import { config } from 'dotenv';
import { defineConfig, env } from 'prisma/config';

// Same precedence as `next dev`: the first file that sets a variable wins.
config({ path: ['.env.development.local', '.env.local', '.env'], quiet: true });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'tsx prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
    shadowDatabaseUrl: env('SHADOW_DATABASE_URL'),
  },
});
