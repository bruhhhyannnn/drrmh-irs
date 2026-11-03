import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkReportCaller } from './report-caller';
import type { CallerCheck, VerifiedProfile } from './server-auth';

// Who may write to a field report (review 3.1.1): its owner or an in-scope admin. Anything that
// only means "someone else is signed in here" waits (retry), so a queued report isn't lost.

const OWNER = 'a0000000-0000-4000-8000-000000000001';
const OTHER = 'b0000000-0000-4000-8000-000000000002';
const profile = (id: string, userType: string, campus: string | null = 'campus-1') =>
  ({ id, user_type: { name: userType }, campus_id: campus }) as unknown as VerifiedProfile;
const signedIn = (p: VerifiedProfile): CallerCheck => ({ ok: true, profile: p });
const report = { user_id: OWNER, campus_id: 'campus-1' };

test('the owner may write', () => {
  assert.equal(checkReportCaller(signedIn(profile(OWNER, 'ERT Member')), report).ok, true);
  // A new report: only the owner.
  const create = { user_id: OWNER, campus_id: null };
  assert.equal(checkReportCaller(signedIn(profile(OWNER, 'ERT Member')), create).ok, true);
});

test('another member is refused with retry', () => {
  const verdict = checkReportCaller(signedIn(profile(OTHER, 'ERT Member')), report);
  assert.equal(verdict.ok, false);
  assert.equal(!verdict.ok && verdict.retry, true);
});

test('an admin whose scope covers the campus may write', () => {
  assert.equal(checkReportCaller(signedIn(profile(OTHER, 'Administrator')), report).ok, true);
  assert.equal(checkReportCaller(signedIn(profile(OTHER, 'Super Admin', null)), report).ok, true);
});

test('an admin of another campus is refused', () => {
  const verdict = checkReportCaller(signedIn(profile(OTHER, 'Administrator', 'campus-2')), report);
  assert.deepEqual(verdict, {
    ok: false,
    error: 'This report could not be found.',
    retry: false,
  });
});

test("an admin can't create a report for another account", () => {
  const create = { user_id: OWNER, campus_id: null };
  const verdict = checkReportCaller(signedIn(profile(OTHER, 'Super Admin', null)), create);
  assert.equal(!verdict.ok && verdict.retry, true);
});

test('signed out waits; the owner inactive is refused for good', () => {
  const signedOut = checkReportCaller({ ok: false, reason: 'signed_out' }, report);
  assert.equal(!signedOut.ok && signedOut.retry, true);
  const otherInactive = checkReportCaller(
    { ok: false, reason: 'inactive', profileId: OTHER },
    report
  );
  assert.equal(!otherInactive.ok && otherInactive.retry, true);
  const ownerInactive = checkReportCaller(
    { ok: false, reason: 'inactive', profileId: OWNER },
    report
  );
  assert.equal(!ownerInactive.ok && ownerInactive.retry, false);
});

test('a report that is gone is refused', () => {
  const verdict = checkReportCaller(signedIn(profile(OWNER, 'ERT Member')), null);
  assert.equal(!verdict.ok && verdict.retry, false);
});
