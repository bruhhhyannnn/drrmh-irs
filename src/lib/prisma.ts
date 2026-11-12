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
  // campus.logo_path (DRRM-036) is read only where it's asked for, so a deploy that reaches a
  // database without the column yet still loads every campus; getCampusLogos reads it.
  return new PrismaClient({ adapter, omit: { campus: { logo_path: true } } });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
