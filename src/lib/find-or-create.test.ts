import { Prisma } from '@prisma/client';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { findOrCreate } from './find-or-create';

const uniqueViolation = () =>
  new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
  });

test('findOrCreate returns the existing row without creating one', async () => {
  let created = 0;
  const id = await findOrCreate(
    async () => ({ id: 'existing' }),
    async () => {
      created += 1;
      return { id: 'new' };
    }
  );
  assert.equal(id, 'existing');
  assert.equal(created, 0);
});

test('findOrCreate creates the row when none exists', async () => {
  const id = await findOrCreate(
    async () => null,
    async () => ({ id: 'new' })
  );
  assert.equal(id, 'new');
});

test('findOrCreate reuses the row another caller inserted on a P2002 race', async () => {
  let finds = 0;
  const id = await findOrCreate(
    async () => {
      finds += 1;
      // First look: nothing yet. After the other caller's insert, the re-find sees it.
      return finds === 1 ? null : { id: 'theirs' };
    },
    async () => {
      throw uniqueViolation();
    }
  );
  assert.equal(id, 'theirs');
  assert.equal(finds, 2);
});

test('findOrCreate rethrows a P2002 when the re-find finds nothing', async () => {
  const boom = uniqueViolation();
  await assert.rejects(
    findOrCreate(
      async () => null,
      async () => {
        throw boom;
      }
    ),
    (err) => err === boom
  );
});

test('findOrCreate rethrows any other error from create without re-finding', async () => {
  const boom = new Error('connection lost');
  let finds = 0;
  await assert.rejects(
    findOrCreate(
      async () => {
        finds += 1;
        return null;
      },
      async () => {
        throw boom;
      }
    ),
    (err) => err === boom
  );
  assert.equal(finds, 1);
});
