// Run with: npx tsx --test scripts/test-matatag-template-actions.ts
// Stub all authentication and database I/O; never use a real account or database.
import nextCache from 'next/cache';
import assert from 'node:assert/strict';
import { mock, test } from 'node:test';
import { publishMatatagTemplate, saveMatatagAssessment } from '../src/actions/matatag';
import { emptyMatatag } from '../src/lib/matatag';
import { defaultMatatagTemplate } from '../src/lib/matatag-template';
import { prisma } from '../src/lib/prisma';

test('server actions enforce Super Admin publishing, revision conflicts, and canonical scoring', async () => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://matatag-test.invalid';
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY = 'test-key';
  const authId = 'af3b9019-9c73-4f49-b9b1-a9d43c02ac6f';
  const campusId = 'bf3b9019-9c73-4f49-b9b1-a9d43c02ac6f';
  const user = {
    id: authId,
    is_active: true,
    campus_id: campusId,
    user_type: { name: 'Administrator' },
  };
  let writes = 0;
  let latest: { id: string; revision: number; definition: typeof defaultMatatagTemplate } | null =
    null;
  mock.method(
    globalThis,
    'fetch',
    async () =>
      new Response(
        JSON.stringify({ id: authId, aud: 'authenticated', email: 'test@example.invalid' }),
        { headers: { 'Content-Type': 'application/json' } }
      )
  );
  const restore: (() => void)[] = [];
  // Prisma's lazy proxy descriptors are incompatible with mock.method.
  function stub(target: object, name: string, value: unknown) {
    const original = Reflect.get(target, name);
    Object.defineProperty(target, name, { value, configurable: true });
    restore.push(() =>
      Object.defineProperty(target, name, { value: original, configurable: true })
    );
  }
  stub(prisma.user, 'findUnique', async () => user);
  stub(prisma.matatagTemplate, 'findFirst', async () => latest);
  stub(prisma.matatagTemplate, 'findUnique', async () => latest);
  stub(prisma.matatagTemplate, 'create', async ({ data }: { data: NonNullable<typeof latest> }) => {
    writes++;
    latest = { ...data, id: authId };
    return latest;
  });
  mock.method(nextCache, 'revalidatePath', () => {});
  try {
    const input = { revision: 0, definition: defaultMatatagTemplate };
    for (const role of ['Administrator', 'ERT Member', 'Bystander']) {
      user.user_type.name = role;
      const result = await publishMatatagTemplate('test-token', input);
      assert.ok('error' in result, `${role} must not publish`);
    }
    assert.equal(writes, 0);
    user.user_type.name = 'Super Admin';
    user.is_active = false;
    assert.deepEqual(await publishMatatagTemplate('test-token', input), {
      error: 'An active account is required.',
    });
    user.is_active = true;
    assert.ok('error' in (await publishMatatagTemplate('', input)));
    assert.ok(
      'error' in
        (await publishMatatagTemplate('test-token', { ...input, definition: { sections: [] } }))
    );
    assert.equal(writes, 0);
    const published = await publishMatatagTemplate('test-token', input);
    assert.ok('data' in published);
    assert.ok(published.data);
    assert.equal(published.data.revision, 1);
    assert.equal(writes, 1);
    const conflict = await publishMatatagTemplate('test-token', input);
    assert.ok('error' in conflict);
    assert.ok(conflict.error);
    assert.match(conflict.error, /Another Super Admin/);
    assert.equal(writes, 1);

    // A client cannot change question scoring by forging the snapshot in a saved document.
    const document = emptyMatatag({
      id: authId,
      definition: structuredClone(defaultMatatagTemplate),
    });
    document.details.campusId = campusId;
    document.answers['I-1'] = 'NO';
    document.template!.sections[0].items[0].starred = true;
    stub(prisma.campus, 'findFirst', async () => ({ id: campusId, name: 'Test campus' }));
    stub(prisma, '$transaction', async (run: (tx: unknown) => unknown) =>
      run({
        matatagAssessment: {
          findUnique: async () => null,
          create: async ({ data }: { data: { document: ReturnType<typeof emptyMatatag> } }) => {
            assert.equal(data.document.template!.sections[0].items[0].starred, false);
            assert.equal(data.document.details.overallScore, '0%');
            return { id: authId, version: 1, status: 'DRAFT' };
          },
        },
      })
    );
    const saved = await saveMatatagAssessment('test-token', {
      id: authId,
      version: 0,
      complete: false,
      document,
    });
    assert.ok('data' in saved);
    assert.equal(saved.data.version, 1);
  } finally {
    mock.restoreAll();
    restore.reverse().forEach((undo) => undo());
    await prisma.$disconnect();
  }
});
