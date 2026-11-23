import { Prisma } from '@prisma/client';

// Pure helper (no Prisma client import at runtime) so it can be unit tested without a database.
// Used by the lookup-name helpers in ./lookup-names.ts.

const isUniqueViolation = (err: unknown) =>
  err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';

/**
 * The id `find` returns, or the one `create` makes. When someone added the same name a moment
 * ago, the insert hits the unique index (#108: case-insensitive since DRRM-048), and theirs is
 * reused instead of failing the save.
 */
export async function findOrCreate(
  find: () => Promise<{ id: string } | null>,
  create: () => Promise<{ id: string }>
) {
  const existing = await find();
  if (existing) return existing.id;
  try {
    return (await create()).id;
  } catch (err) {
    if (!isUniqueViolation(err)) throw err;
    const theirs = await find();
    if (theirs) return theirs.id;
    throw err;
  }
}
