import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

/** A database that won't answer should fail the request, not leave it waiting forever. */
const CONNECTION_TIMEOUT_MS = 8_000;

function createPrismaClient() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL!,
    connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
  });
  // campus.logo_path (DRRM-036) and users.avatar_url / show_avatar (DRRM-039) are read only where
  // they're asked for, so a deploy that reaches a database without the columns yet still loads
  // every campus and user; getCampusLogos and src/lib/avatars.ts read them.
  return new PrismaClient({
    adapter,
    omit: { campus: { logo_path: true }, user: { avatar_url: true, show_avatar: true } },
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
