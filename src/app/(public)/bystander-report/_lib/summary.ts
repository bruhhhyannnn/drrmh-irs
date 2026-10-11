import type { BystanderCasualty, BystanderMissingPerson } from '@/lib';

// Short text summaries shared by step 2, the review step and the people drawers.

/** How a person without a name is shown. The name itself is stored blank. */
export const UNKNOWN_PERSON = 'Unknown person';

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const SEX_LABELS: Record<BystanderMissingPerson['sex'], string | null> = {
  male: 'Male',
  female: 'Female',
  unknown: null,
};

/** "Female · 34 yrs · Cut on the left arm" — only the parts that are known. */
export function personMeta(person: BystanderMissingPerson & { diagnosis?: string | null }) {
  const parts = [
    SEX_LABELS[person.sex],
    person.age != null ? `${person.age} yrs` : null,
    person.diagnosis?.trim() || null,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'No details added';
}

/** "Minor" for one casualty, "2 Minor, 1 Serious" for several. */
export function conditionSummary(
  casualties: BystanderCasualty[],
  conditionName: (id: string) => string
) {
  const tally = new Map<string, number>();
  for (const casualty of casualties) {
    const name = conditionName(casualty.condition_id);
    tally.set(name, (tally.get(name) ?? 0) + 1);
  }
  if (casualties.length === 1) return [...tally.keys()][0];
  return [...tally].map(([name, n]) => `${n} ${name}`).join(', ');
}

/** "1 casualty · Minor" — the meta line on the step 2 Casualties row. */
export function casualtiesMeta(
  casualties: BystanderCasualty[],
  conditionName: (id: string) => string
) {
  if (!casualties.length) return 'None added';
  return `${plural(casualties.length, 'casualty', 'casualties')} · ${conditionSummary(casualties, conditionName)}`;
}

export function missingPersonsMeta(missingPersons: BystanderMissingPerson[]) {
  if (!missingPersons.length) return 'None added';
  return `${plural(missingPersons.length, 'person', 'people')} · ${missingPersons
    .map((p) => p.name || UNKNOWN_PERSON)
    .join(', ')}`;
}

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

/** "14.5779° N, 120.9846° E" */
export function formatCoordinates(lat: number, lng: number) {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(4)}° ${ns}, ${Math.abs(lng).toFixed(4)}° ${ew}`;
}

export function photosLabel(count: number) {
  return count ? plural(count, 'photo', 'photos') : 'None';
}
