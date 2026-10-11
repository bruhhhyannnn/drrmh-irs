import { formatCoordinates } from '@/components/ds/format';
import {
  casualtiesMeta,
  conditionSummary,
  missingPersonsMeta,
  plural,
} from '@/components/ds/people';
import type { BystanderCasualty, BystanderMissingPerson } from '@/lib';

// Short text summaries shared by step 2 and the review step. The per-person helpers live in
// the design system, since the ERT form uses them too.

export { casualtiesMeta, formatCoordinates, missingPersonsMeta };

/** "No missing persons · 1 casualty (Minor)", or null when neither was added. */
export function peopleSummary(
  missingPersons: BystanderMissingPerson[],
  casualties: BystanderCasualty[],
  conditionName: (id: string) => string
) {
  if (!missingPersons.length && !casualties.length) return null;
  const missing = missingPersons.length
    ? plural(missingPersons.length, 'missing person', 'missing persons')
    : 'No missing persons';
  const hurt = casualties.length
    ? `${plural(casualties.length, 'casualty', 'casualties')} (${conditionSummary(casualties, conditionName)})`
    : 'No casualties';
  return `${missing} · ${hurt}`;
}

/** "8 people · Students 6, Faculty Members 1", largest first, or null when all are 0. */
export function headcountSummary(entries: { name: string; count: number }[]) {
  const filled = entries.filter((e) => e.count > 0).sort((a, b) => b.count - a.count);
  const total = filled.reduce((sum, e) => sum + e.count, 0);
  if (!total) return null;
  return `${plural(total, 'person', 'people')} · ${filled.map((e) => `${e.name} ${e.count}`).join(', ')}`;
}

export function photosLabel(count: number) {
  return count ? plural(count, 'photo', 'photos') : 'None';
}
