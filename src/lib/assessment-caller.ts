import { canUseAssessment } from './access';
import type { CreateAssessmentResult } from './assessment-template';
import type { CallerCheck, VerifiedProfile } from './server-auth';

// Whether the account behind a token may submit an assessment started by `evaluatorId`. Phones
// are shared: an assessment queued by one ERT member can be flushed while someone else is
// signed in. Everything that only means "it isn't the owner who is signed in" is `retry: true`,
// so the owner's entry keeps waiting; only the owner's own account can refuse it for good.

const CANT_SUBMIT = "Your account can't submit assessments.";
const OTHER_ACCOUNT =
  'This assessment belongs to another account. It sends when that account signs in on this phone.';

type Refusal = Extract<CreateAssessmentResult, { ok: false }>;

export function checkAssessmentCaller(
  caller: CallerCheck,
  evaluatorId: unknown
): { ok: true; profile: VerifiedProfile; campusId: string | null } | Refusal {
  const wait = (error: string): Refusal => ({ ok: false, error, retry: true });
  const refuse = (error: string): Refusal => ({ ok: false, error, retry: false });

  if (!caller.ok) {
    if (caller.reason === 'signed_out') return wait('Sign in again to send this assessment.');
    if (caller.reason === 'inactive' && caller.profileId === evaluatorId) {
      return refuse(CANT_SUBMIT);
    }
    return wait(OTHER_ACCOUNT);
  }

  const { profile } = caller;
  if (profile.id !== evaluatorId) return wait(OTHER_ACCOUNT);
  if (!canUseAssessment(profile)) return refuse(CANT_SUBMIT);
  // An off-campus account (DRRM-026) has no campus: its buildings belong to none.
  if (profile.is_off_campus) return { ok: true, profile, campusId: null };
  if (!profile.campus_id) return refuse('Your profile has no campus yet.');
  return { ok: true, profile, campusId: profile.campus_id };
}
