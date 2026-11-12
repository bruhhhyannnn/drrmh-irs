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
  // campus.logo_path (DRRM-036), users.avatar_url / show_avatar (DRRM-039) and
  // bystander_reports.seen_at (DRRM-042) are read only where they're asked for, so a deploy that
  // reaches a database without the columns yet still loads everything; getCampusLogos,
  // src/lib/avatars.ts and getBystanderReports read them with queries that tolerate them missing.
  return new PrismaClient({
    adapter,
    omit: {
      campus: { logo_path: true },
      user: { avatar_url: true, show_avatar: true },
      bystander_reports: { seen_at: true },
    },
  });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
