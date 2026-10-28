import assert from 'node:assert/strict';
import { test } from 'node:test';
import { checkAssessmentCaller } from './assessment-caller';
import type { CallerCheck, VerifiedProfile } from './server-auth';

// Who may send an assessment queued on a shared phone (review C1): anything that only means
// "someone else is signed in here" must wait (retry), never fail the owner's entry for good.

const A = 'a0000000-0000-4000-8000-000000000001';
const B = 'b0000000-0000-4000-8000-000000000002';
const profile = (id: string, userType: string, campus: string | null = 'campus-1') =>
  ({
    id,
    user_type: { name: userType },
    position: null,
    campus_id: campus,
  }) as unknown as VerifiedProfile;
const signedIn = (p: VerifiedProfile): CallerCheck => ({ ok: true, profile: p });

test("another account on the phone keeps the owner's entry waiting", () => {
  const callers: CallerCheck[] = [
    signedIn(profile(B, 'Administrator')),
    signedIn(profile(B, 'Bystander')),
    signedIn(profile(B, 'ERT Member', null)),
    signedIn(profile(B, 'ERT Member')),
    { ok: false, reason: 'no_profile' },
    { ok: false, reason: 'inactive', profileId: B },
    { ok: false, reason: 'signed_out' },
  ];
  for (const caller of callers) {
    const verdict = checkAssessmentCaller(caller, A);
    assert.equal(verdict.ok, false);
    assert.equal(!verdict.ok && verdict.retry, true, JSON.stringify(caller));
  }
});

test("the owner's own account decides for good", () => {
  assert.deepEqual(checkAssessmentCaller({ ok: false, reason: 'inactive', profileId: A }, A), {
    ok: false,
    error: "Your account can't submit assessments.",
    retry: false,
  });
  const admin = checkAssessmentCaller(signedIn(profile(A, 'Administrator')), A);
  assert.equal(!admin.ok && admin.retry, false);
  assert.deepEqual(checkAssessmentCaller(signedIn(profile(A, 'ERT Member', null)), A), {
    ok: false,
    error: 'Your profile has no campus yet.',
    retry: false,
  });
  const ok = checkAssessmentCaller(signedIn(profile(A, 'ERT Member')), A);
  assert.equal(ok.ok, true);
  assert.equal(ok.ok && ok.campusId, 'campus-1');
});
