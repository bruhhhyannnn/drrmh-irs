import { REPORT_OFF_CAMPUS_MESSAGE } from './access';
import { adminScope, inScope } from './admin-scope';
import type { CallerCheck, VerifiedProfile } from './server-auth';

// Who may write to a field report: its owner, or an admin whose scope covers the report's
// campus. Phones are shared, so as in assessment-caller.ts everything that only means "it isn't
// the owner who is signed in" is `retry: true`: a report queued by one member waits for them
// instead of failing while someone else is signed in.

const OTHER_ACCOUNT =
  'This report belongs to another account. It sends when that account signs in on this phone.';
const NOT_FOUND = 'This report could not be found.';

export type ReportRefusal = { ok: false; error: string; retry: boolean };

/**
 * The answer when saving a report fails on the server. Thrown messages are hidden in production
 * (React error #441), so the phone gets this instead. Only a report pointing at a row that is
 * gone can never work; anything else keeps its answers on the phone for another try.
 */
export function reportSaveFailure(err: unknown): ReportRefusal {
  if ((err as { code?: unknown } | null)?.code === 'P2003') {
    return {
      ok: false,
      error: 'The event or cluster on this report no longer exists.',
      retry: false,
    };
  }
  return {
    ok: false,
    error: 'The report couldn’t be saved. Your answers are still here, so please try again.',
    retry: true,
  };
}

/** Shown when a member writes to a report on an event that is no longer ongoing (#108). */
export const EVENT_CLOSED =
  'This event has ended, so its reports can no longer be changed. Ask an administrator.';

const wait = (error: string): ReportRefusal => ({ ok: false, error, retry: true });
const refuse = (error: string): ReportRefusal => ({ ok: false, error, retry: false });

/**
 * Whether the caller may write to this report: an admin whose scope covers its campus always;
 * its owner only while its event is ongoing (`event_open`, #108: members can't change reports
 * of a completed event, as the app already shows).
 */
export function checkReportCaller(
  caller: CallerCheck,
  /** `campus_id: null` when only the owner may write, as for a new report. */
  report: { user_id: string | null; campus_id: string | null; event_open?: boolean } | null
): { ok: true; profile: VerifiedProfile } | ReportRefusal {
  if (!caller.ok) {
    if (caller.reason === 'signed_out') return wait('Sign in again to send this report.');
    if (caller.reason === 'inactive' && report && caller.profileId === report.user_id) {
      return refuse("Your account can't send reports.");
    }
    return wait(OTHER_ACCOUNT);
  }
  if (!report) return refuse(NOT_FOUND);

  const { profile } = caller;
  if (profile.is_off_campus) return refuse(REPORT_OFF_CAMPUS_MESSAGE);
  const scope = adminScope(profile);
  if (scope.ok && report.campus_id && inScope(scope, report.campus_id)) {
    return { ok: true, profile };
  }
  if (profile.id === report.user_id) {
    return report.event_open === false ? refuse(EVENT_CLOSED) : { ok: true, profile };
  }
  if (scope.ok && report.campus_id) return refuse(NOT_FOUND);
  return wait(OTHER_ACCOUNT);
}

/** Whether an event's status name means it is ongoing. */
export const isOngoing = (statusName: string | null | undefined) =>
  statusName?.trim().toLowerCase() === 'ongoing';

/** What `checkNewReport` reads from the database for a new report. */
export type NewReportTarget = {
  event: { campus_id: string; status: string; ended_at: Date | null } | null;
  /** The cluster picked on the form; null when it doesn't exist. */
  cluster: { campus_id: string } | null;
  /** The unit picked on the form: undefined when none was picked, null when it doesn't exist. */
  unit?: { cluster_id: string } | null;
  clusterId: string;
  /** When the report was sent on the phone (the offline queue's `sent_at`). */
  sentAt?: Date;
  /** Whether this member already has a report on the event. */
  hasReport: boolean;
};

/**
 * Where a new report may go (#101, #108), decided on the server. The event must be on the
 * caller's campus (an admin's: in their scope), and the cluster on the event's campus with the
 * unit in that cluster. A member may file only while the event is ongoing, or for a report sent
 * on the phone before the event ended (queued offline), and only one report per event. Admins
 * filing from the Reports page may add more, on any event in their scope.
 */
export function checkNewReport(
  profile: Pick<VerifiedProfile, 'campus_id'> & { user_type?: { name: string } | null },
  target: NewReportTarget
): { ok: true; admin: boolean } | ReportRefusal {
  const { event } = target;
  if (!event) return refuse('This event no longer exists.');
  const scope = adminScope(profile);
  const admin = scope.ok && inScope(scope, event.campus_id);
  if (!admin && (scope.ok || event.campus_id !== profile.campus_id)) {
    return refuse('This event is on another campus.');
  }
  if (!admin && !isOngoing(event.status)) {
    const sentWhileOpen =
      event.status.trim().toLowerCase() === 'completed' &&
      !!target.sentAt &&
      !!event.ended_at &&
      target.sentAt.getTime() <= event.ended_at.getTime();
    if (!sentWhileOpen) return refuse('This event is not ongoing, so it takes no reports.');
  }
  if (!target.cluster || target.cluster.campus_id !== event.campus_id) {
    return refuse("That cluster isn't on this event's campus. Pick the cluster again.");
  }
  if (target.unit === null || (target.unit && target.unit.cluster_id !== target.clusterId)) {
    return refuse("That unit isn't in this cluster. Pick the unit again.");
  }
  if (!admin && target.hasReport) {
    return refuse('You already sent a report for this event. Open it to make changes.');
  }
  return { ok: true, admin };
}
