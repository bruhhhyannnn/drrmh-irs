// Status colours shared by every admin page: ongoing, verified and active are green; upcoming
// and pending amber; completed and reviewed blue; dismissed and inactive grey. Red is kept for
// casualties and delete.

export type Tone = 'green' | 'amber' | 'blue' | 'grey' | 'red' | 'maroon' | 'neutral';

export const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export type EventStatus = 'ongoing' | 'upcoming' | 'completed';

export function eventStatusKey(name?: string | null): EventStatus | 'other' {
  const key = (name ?? '').toLowerCase();
  return key === 'ongoing' || key === 'upcoming' || key === 'completed' ? key : 'other';
}

export function eventTone(name?: string | null): Tone {
  const key = eventStatusKey(name);
  if (key === 'ongoing') return 'green';
  if (key === 'upcoming') return 'amber';
  if (key === 'completed') return 'blue';
  return 'grey';
}

export type BystanderStatusName = 'pending' | 'reviewed' | 'verified' | 'dismissed';

/** A report without a status is still waiting, so it reads as pending. */
export function bystanderStatusKey(name?: string | null): BystanderStatusName {
  const key = (name ?? 'pending').toLowerCase();
  return key === 'reviewed' || key === 'verified' || key === 'dismissed' ? key : 'pending';
}

export function bystanderTone(name?: string | null): Tone {
  const key = bystanderStatusKey(name);
  if (key === 'verified') return 'green';
  if (key === 'reviewed') return 'blue';
  if (key === 'dismissed') return 'grey';
  return 'amber';
}

/** "ERT Member" reads as ERT, "Administrator" as Admin. */
export function userTypeLabel(name?: string | null) {
  if (name === 'ERT Member') return 'ERT';
  if (name === 'Administrator') return 'Admin';
  return name ?? '—';
}

export const userTypeTone = (name?: string | null): Tone =>
  name === 'Administrator' || name === 'Super Admin' ? 'maroon' : 'neutral';
