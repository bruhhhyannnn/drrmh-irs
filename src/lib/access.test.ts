import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  adminGuard,
  canUseAssessment,
  canUseReport,
  ertGuard,
  homePathFor,
  signInDestination,
} from './access';

test('Phase 1: ERT members only', () => {
  assert.equal(
    canUseAssessment({ user_type: { name: 'ERT Member' }, position: { name: 'Marshall' } }),
    true
  );
  for (const name of ['Administrator', 'Super Admin', 'Bystander']) {
    assert.equal(canUseAssessment({ user_type: { name } }), false, name);
  }
  assert.equal(canUseAssessment(null), false);
});

const ert = { user_type: { name: 'ERT Member' }, is_profile_complete: true };
const admin = { user_type: { name: 'Administrator' }, is_profile_complete: true };
const settled = { loading: false, hasUser: true, profileError: null };

test('everyone lands on one home: admins on the dashboard, anyone else on /home', () => {
  assert.equal(homePathFor('Administrator'), '/dashboard');
  assert.equal(homePathFor('Super Admin'), '/dashboard');
  assert.equal(homePathFor('ERT Member'), '/home');
  assert.equal(homePathFor('Bystander'), '/home');
  assert.equal(homePathFor(null), '/home');
});

test('after sign-in an ERT member goes straight to /home, even with an admin ?from=', () => {
  assert.equal(signInDestination('ERT Member', null), '/home');
  assert.equal(signInDestination('ERT Member', '/dashboard'), '/home');
});

test('after sign-in an admin goes back to ?from=, or to the dashboard', () => {
  assert.equal(signInDestination('Administrator', null), '/dashboard');
  assert.equal(signInDestination('Super Admin', '/events/details?id=1'), '/events/details?id=1');
});

test('after sign-in ?from= never leaves the app or returns to sign-in', () => {
  for (const from of [
    'https://evil.test',
    '//evil.test',
    '/\\evil.test',
    'events',
    '/signin',
    '/signin?from=/x',
    '/signin/',
    'javascript:alert(1)',
  ]) {
    assert.equal(signInDestination('Administrator', from), '/dashboard', from);
  }
});

test('a tab, newline or carriage return in ?from= cannot reach another site (#110)', () => {
  for (const from of [
    '/\t/evil.example/login',
    '/\n/evil.example',
    '/\r/evil.example',
    '/\u0000/evil.example',
    '/%09/evil.example',
  ]) {
    const to = signInDestination('Super Admin', from);
    // Where the browser would go from this app: always this app.
    assert.equal(new URL(to, 'https://irs.test').origin, 'https://irs.test', JSON.stringify(from));
  }
  assert.equal(signInDestination('Super Admin', '/\t/evil.example/login'), '/dashboard');
});

test('an in-app ?from= keeps its query and hash', () => {
  assert.equal(
    signInDestination('Administrator', '/events/details?id=abc&tab=2#reports'),
    '/events/details?id=abc&tab=2#reports'
  );
});

test('the admin guard never lets a non-admin through, so admin pages do not mount for them', () => {
  assert.deepEqual(adminGuard({ ...settled, profile: ert }), { status: 'redirect', to: '/home' });
  assert.deepEqual(adminGuard({ ...settled, profile: { user_type: null } }), {
    status: 'redirect',
    to: '/home',
  });
});

test('the admin guard allows admins once the profile has loaded', () => {
  assert.deepEqual(adminGuard({ ...settled, profile: admin }), { status: 'allow' });
  assert.deepEqual(adminGuard({ ...settled, loading: true, profile: admin }), {
    status: 'checking',
  });
  assert.deepEqual(adminGuard({ ...settled, profile: null }), { status: 'checking' });
});

test('the admin guard sends the signed out to sign-in and reports a failed profile load', () => {
  assert.deepEqual(adminGuard({ ...settled, hasUser: false, profile: null }), {
    status: 'signin',
  });
  assert.deepEqual(adminGuard({ ...settled, profile: null, profileError: 'Failed' }), {
    status: 'error',
  });
});

test('a turned-off account is stopped by both guards, even from a kept profile (#104)', () => {
  assert.deepEqual(adminGuard({ ...settled, profile: { ...admin, is_active: false } }), {
    status: 'error',
  });
  assert.deepEqual(ertGuard({ ...settled, profile: { ...ert, is_active: false } }), {
    status: 'error',
  });
  assert.deepEqual(adminGuard({ ...settled, profile: { ...admin, is_active: true } }), {
    status: 'allow',
  });
});

test('the ERT guard reports a failed profile load instead of checking forever', () => {
  assert.deepEqual(ertGuard({ ...settled, profile: null, profileError: 'Failed' }), {
    status: 'error',
  });
});

test('the ERT guard routes the signed out, admins and those who may not assess', () => {
  assert.deepEqual(ertGuard({ ...settled, hasUser: false, profile: null }), {
    status: 'redirect',
    to: '/signin',
  });
  assert.deepEqual(ertGuard({ ...settled, profile: admin }), {
    status: 'redirect',
    to: '/dashboard',
  });
  assert.deepEqual(
    ertGuard(
      { ...settled, profile: { user_type: { name: 'Bystander' }, is_profile_complete: true } },
      { requireAssessment: true }
    ),
    { status: 'redirect', to: '/home' }
  );
});

test('the ERT guard asks for setup first, then is ready', () => {
  assert.deepEqual(ertGuard({ ...settled, loading: true, profile: ert }), { status: 'checking' });
  assert.deepEqual(ertGuard({ ...settled, profile: null }), { status: 'checking' });
  assert.deepEqual(ertGuard({ ...settled, profile: { ...ert, is_profile_complete: false } }), {
    status: 'setup',
  });
  assert.deepEqual(ertGuard({ ...settled, profile: ert }, { requireAssessment: true }), {
    status: 'ready',
  });
});

test('an off-campus account has no Report tool, everyone else does (DRRM-026)', () => {
  assert.equal(canUseReport({ ...ert, is_off_campus: true }), false);
  assert.equal(canUseReport(ert), true);
  assert.equal(canUseReport({ ...ert, is_off_campus: false }), true);
  assert.equal(canUseAssessment({ ...ert, is_off_campus: true }), true);
});
