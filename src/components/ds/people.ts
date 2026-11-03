import type { PhotoItem } from './photo-field';

// People entered in the missing persons / casualties drawers, and the short text summaries
// shown for them. Shared by the bystander and ERT report forms.

export type PersonSex = 'male' | 'female' | 'unknown';

export interface PersonEntry {
  name: string;
  /** Left blank when unknown, rather than saved as 0. */
  age: number | null;
  sex: PersonSex;
}

export interface CasualtyEntry extends PersonEntry {
  condition_id: string;
  diagnosis?: string | null;
  /** Row id, when the casualty is already saved on a report. */
  id?: string;
  /** Photos of the injury taken on this phone and not sent yet (ERT only). */
  photos?: PhotoItem[];
  /** Photos already saved with the casualty. */
  photoCount?: number;
}

/** How a person without a name is shown. The name itself is stored blank. */
export const UNKNOWN_PERSON = 'Unknown person';

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

const SEX_LABELS: Record<PersonSex, string | null> = {
  male: 'Male',
  female: 'Female',
  unknown: null,
};

/** "Female · 34 yrs · Cut on the left arm · 2 photos" — only the parts that are known. */
export function personMeta(
  person: PersonEntry & Pick<CasualtyEntry, 'diagnosis' | 'photos' | 'photoCount'>
) {
  const photos = person.photos?.length || person.photoCount || 0;
  const parts = [
    SEX_LABELS[person.sex],
    person.age != null ? `${person.age} yrs` : null,
    person.diagnosis?.trim() || null,
    photos ? plural(photos, 'photo', 'photos') : null,
  ].filter(Boolean);
  return parts.length ? parts.join(' · ') : 'No details added';
}

/** "Minor" for one casualty, "2 Minor, 1 Serious" for several. */
export function conditionSummary(
  casualties: Pick<CasualtyEntry, 'condition_id'>[],
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

/** "1 casualty · Minor" — the meta line on a Casualties row. */
export function casualtiesMeta(
  casualties: Pick<CasualtyEntry, 'condition_id'>[],
  conditionName: (id: string) => string
) {
  if (!casualties.length) return 'None added';
  return `${plural(casualties.length, 'casualty', 'casualties')} · ${conditionSummary(casualties, conditionName)}`;
}

/** "2 people · Maria Santos, Unknown person" — the meta line on a Missing persons row. */
export function missingPersonsMeta(missingPersons: Pick<PersonEntry, 'name'>[]) {
  if (!missingPersons.length) return 'None added';
  return `${plural(missingPersons.length, 'person', 'people')} · ${missingPersons
    .map((p) => p.name || UNKNOWN_PERSON)
    .join(', ')}`;
}
