import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  checkNewReport,
  checkReportCaller,
  isOngoing,
  reportSaveFailure,
  type NewReportTarget,
} from './report-caller';
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

test('a server fault saving a report keeps it for another try, with a readable message', () => {
  const missingColumn = Object.assign(new Error('column does not exist'), { code: 'P2022' });
  for (const err of [missingColumn, new Error('boom'), 'boom']) {
    const failure = reportSaveFailure(err);
    assert.equal(failure.ok, false);
    assert.equal(failure.retry, true);
    assert.doesNotMatch(failure.error, /column|boom/);
  }
});

test('a report pointing at a removed event or cluster is refused, not retried forever', () => {
  const failure = reportSaveFailure(Object.assign(new Error('fk'), { code: 'P2003' }));
  assert.equal(failure.retry, false);
  assert.match(failure.error, /no longer exists/);
});

test('an off-campus account is refused for good, with the message (DRRM-026)', () => {
  const offCampus = {
    ...profile(OWNER, 'ERT Member', null),
    is_off_campus: true,
  } as unknown as VerifiedProfile;
  assert.deepEqual(checkReportCaller(signedIn(offCampus), { user_id: OWNER, campus_id: null }), {
    ok: false,
    error: 'Not available for off-campus accounts',
    retry: false,
  });
});

/* ─── Event lock and where a new report may go (#101, #108) ─── */

test('the owner can no longer change a report once its event has ended', () => {
  const closed = { ...report, event_open: false };
  const verdict = checkReportCaller(signedIn(profile(OWNER, 'ERT Member')), closed);
  assert.equal(verdict.ok, false);
  assert.equal(!verdict.ok && verdict.retry, false);
  // An admin in scope still can.
  assert.equal(checkReportCaller(signedIn(profile(OTHER, 'Administrator')), closed).ok, true);
  assert.equal(checkReportCaller(signedIn(profile(OWNER, 'Super Admin', null)), closed).ok, true);
});

const ended = new Date('2026-03-12T08:00:00Z');
const target = (over: Partial<NewReportTarget> = {}): NewReportTarget => ({
  event: { campus_id: 'campus-1', status: 'Ongoing', ended_at: null },
  cluster: { campus_id: 'campus-1' },
  unit: undefined,
  clusterId: 'cluster-1',
  hasReport: false,
  ...over,
});
const member = profile(OWNER, 'ERT Member');
const reason = (v: ReturnType<typeof checkNewReport>) => (v.ok ? 'ok' : v.error);

test('a member files on an ongoing event of their own campus', () => {
  assert.deepEqual(checkNewReport(member, target()), { ok: true, admin: false });
  assert.deepEqual(checkNewReport(member, target({ unit: { cluster_id: 'cluster-1' } })), {
    ok: true,
    admin: false,
  });
});

test("a member can't file on another campus's event or a missing one", () => {
  assert.match(
    reason(
      checkNewReport(member, target({ event: { ...target().event!, campus_id: 'campus-2' } }))
    ),
    /another campus/
  );
  assert.match(reason(checkNewReport(member, target({ event: null }))), /no longer exists/);
});

test("a member can't file on an upcoming or completed event, unless it was sent before it ended", () => {
  const completed = { campus_id: 'campus-1', status: 'Completed', ended_at: ended };
  assert.match(reason(checkNewReport(member, target({ event: completed }))), /not ongoing/);
  assert.match(
    reason(checkNewReport(member, target({ event: { ...completed, status: 'Upcoming' } }))),
    /not ongoing/
  );
  // Queued offline while the event was still on.
  const before = new Date(ended.getTime() - 60_000);
  assert.equal(checkNewReport(member, target({ event: completed, sentAt: before })).ok, true);
  const after = new Date(ended.getTime() + 60_000);
  assert.equal(checkNewReport(member, target({ event: completed, sentAt: after })).ok, false);
});

test('the cluster must be on the event campus and the unit in the cluster', () => {
  assert.match(
    reason(checkNewReport(member, target({ cluster: { campus_id: 'campus-2' } }))),
    /cluster/
  );
  assert.match(reason(checkNewReport(member, target({ cluster: null }))), /cluster/);
  assert.match(
    reason(checkNewReport(member, target({ unit: { cluster_id: 'cluster-2' } }))),
    /unit/
  );
  assert.match(reason(checkNewReport(member, target({ unit: null }))), /unit/);
});

test('one report per member per event; admins in scope may add more, on any event', () => {
  assert.match(reason(checkNewReport(member, target({ hasReport: true }))), /already sent/);
  const admin = profile(OTHER, 'Administrator');
  const completed = { campus_id: 'campus-1', status: 'Completed', ended_at: ended };
  assert.deepEqual(checkNewReport(admin, target({ hasReport: true, event: completed })), {
    ok: true,
    admin: true,
  });
  // An Administrator of another campus is refused.
  const otherAdmin = profile(OTHER, 'Administrator', 'campus-2');
  assert.match(reason(checkNewReport(otherAdmin, target())), /another campus/);
});

test('ongoing is read from the status name', () => {
  assert.equal(isOngoing('Ongoing'), true);
  assert.equal(isOngoing(' ongoing '), true);
  assert.equal(isOngoing('Completed'), false);
  assert.equal(isOngoing(null), false);
});
