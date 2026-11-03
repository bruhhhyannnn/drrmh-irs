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

export function checkReportCaller(
  caller: CallerCheck,
  /** `campus_id: null` when only the owner may write, as for a new report. */
  report: { user_id: string | null; campus_id: string | null } | null
): { ok: true; profile: VerifiedProfile } | ReportRefusal {
  const wait = (error: string): ReportRefusal => ({ ok: false, error, retry: true });
  const refuse = (error: string): ReportRefusal => ({ ok: false, error, retry: false });

  if (!caller.ok) {
    if (caller.reason === 'signed_out') return wait('Sign in again to send this report.');
    if (caller.reason === 'inactive' && report && caller.profileId === report.user_id) {
      return refuse("Your account can't send reports.");
    }
    return wait(OTHER_ACCOUNT);
  }
  if (!report) return refuse(NOT_FOUND);

  const { profile } = caller;
  if (profile.id === report.user_id) return { ok: true, profile };
  const scope = adminScope(profile);
  if (scope.ok && report.campus_id) {
    return inScope(scope, report.campus_id) ? { ok: true, profile } : refuse(NOT_FOUND);
  }
  return wait(OTHER_ACCOUNT);
}
