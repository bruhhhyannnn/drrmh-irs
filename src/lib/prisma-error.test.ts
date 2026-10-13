import { Prisma } from '@prisma/client';
import { describe, expect, it } from 'vitest';
import { toFriendlyError } from './prisma-error';

const prismaError = (code: string) =>
  new Prisma.PrismaClientKnownRequestError(`Raw ${code} message`, { code, clientVersion: 'test' });

describe('toFriendlyError', () => {
  it.each([
    [
      'P2003',
      'Cannot delete this cluster — it is still in use by other records. Reassign or remove those first.',
    ],
    ['P2002', 'A cluster with that value already exists.'],
    ['P2025', 'This cluster could not be found. It may have already been removed.'],
  ])('explains %s', (code, message) => {
    expect(toFriendlyError(prismaError(code), 'cluster').message).toBe(message);
  });

  it('passes other errors through', () => {
    const unknownCode = prismaError('P2034');
    expect(toFriendlyError(unknownCode, 'cluster')).toBe(unknownCode);

    const plain = new Error('Connection refused');
    expect(toFriendlyError(plain, 'cluster')).toBe(plain);
  });

  it('wraps a thrown non-error', () => {
    expect(toFriendlyError('boom', 'unit').message).toBe('Something went wrong with this unit.');
  });
});
