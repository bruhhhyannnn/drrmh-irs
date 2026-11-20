import assert from 'node:assert/strict';
import { test } from 'node:test';
import { googleIdentity, splitFullName, usernameFor } from './google-provision';

const AUTH_ID = '0b5c3a1e-2f4d-4a6b-8c9d-0e1f2a3b4c5d';
const google = {
  id: AUTH_ID,
  email: 'Juan.DelaCruz@up.edu.ph',
  email_confirmed_at: '2026-11-20T00:00:00Z',
  app_metadata: { provider: 'google', providers: ['google'] },
  user_metadata: { full_name: 'Juan Dela Cruz' },
};

test('a confirmed @up.edu.ph Google account is provisioned from its verified details', () => {
  assert.deepEqual(googleIdentity(google), {
    ok: true,
    authId: AUTH_ID,
    email: 'juan.delacruz@up.edu.ph',
    fullName: 'Juan Dela Cruz',
  });
  assert.equal(
    googleIdentity({ ...google, user_metadata: { name: 'Maria Santos' } }).ok && 'name',
    'name'
  );
});

test('a Google account outside up.edu.ph gets no profile (#100)', () => {
  for (const email of ['someone@gmail.com', 'x@up.edu.ph.evil.com', '@up.edu.ph', null]) {
    assert.deepEqual(googleIdentity({ ...google, email }), { ok: false, reason: 'domain' }, email!);
  }
});

test('an email-and-password or unconfirmed account is not treated as Google (#100)', () => {
  assert.deepEqual(
    googleIdentity({ ...google, app_metadata: { provider: 'email', providers: ['email'] } }),
    { ok: false, reason: 'not_google' }
  );
  assert.deepEqual(googleIdentity({ ...google, email_confirmed_at: null }), {
    ok: false,
    reason: 'not_google',
  });
});

test('an admin-made account later linked to Google still counts as Google', () => {
  const linked = { ...google, app_metadata: { provider: 'email', providers: ['email', 'google'] } };
  assert.equal(googleIdentity(linked).ok, true);
});

test('the name and username are built from the verified details', () => {
  assert.deepEqual(splitFullName('Juan  Dela Cruz'), { first: 'Juan', last: 'Dela Cruz' });
  assert.deepEqual(splitFullName(null), { first: '', last: '' });
  assert.equal(usernameFor('juan.delacruz@up.edu.ph', AUTH_ID), 'juandelacruz-0b5c3a');
});
