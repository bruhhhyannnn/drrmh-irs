import type { CasualtyEntry, PersonEntry } from '@/components/ds';

// The report form saves a draft on the phone after each change, so a refresh, a closed tab or
// a sign-in timeout doesn't lose the counts. One draft per member; it remembers its event and
// is dropped if that event is no longer ongoing. Removed once the report submits or is saved
// offline.

interface ReportDraft {
  version: 1;
  eventId: string;
  location: { lat: number; lng: number; name: string | null } | null;
  counts: Record<string, number>;
  damageId: string;
  missingPersons: PersonEntry[];
  casualties: CasualtyEntry[];
  savedAt: number;
}

const draftKey = (userId: string) => `irs:ert-report-draft:${userId}`;

// Storage can be unavailable (private mode, blocked site data); the form then just works
// without drafts.

export function loadDraft(userId: string): ReportDraft | null {
  try {
    const raw = localStorage.getItem(draftKey(userId));
    if (!raw) return null;
    const draft = JSON.parse(raw) as ReportDraft;
    return draft?.version === 1 ? draft : null;
  } catch {
    return null;
  }
}

export function saveDraft(userId: string, draft: ReportDraft) {
  try {
    localStorage.setItem(draftKey(userId), JSON.stringify(draft));
  } catch {
    // ignore — see above
  }
}

export function clearDraft(userId: string) {
  try {
    localStorage.removeItem(draftKey(userId));
  } catch {
    // ignore — see above
  }
}
