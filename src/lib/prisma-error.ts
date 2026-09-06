import { Prisma } from '@prisma/client';

/**
 * Prisma throws opaque, low-level errors (raw constraint names, no context) that are
 * useless to show a user. This maps the common cases — FK violations on delete, unique
 * violations on create/update, and "record not found" — to a message a user can act on.
 */
export function toFriendlyError(error: unknown, label: string): Error {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2003':
        return new Error(
          `Cannot delete this ${label} — it is still in use by other records. Reassign or remove those first.`
        );
      case 'P2002':
        return new Error(`A ${label} with that value already exists.`);
      case 'P2025':
        return new Error(`This ${label} could not be found. It may have already been removed.`);
    }
  }
  return error instanceof Error ? error : new Error(`Something went wrong with this ${label}.`);
}
