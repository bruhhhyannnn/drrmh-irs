import { format, isSameDay } from 'date-fns';

type DateLike = Date | string | null | undefined;

const toDate = (d: DateLike) => (d ? new Date(d) : null);

/** Oct 8, 2026 */
export function formatDate(d: DateLike) {
  const date = toDate(d);
  return date ? format(date, 'MMM d, yyyy') : '—';
}

/** 9:08 AM */
export function formatTime(d: DateLike) {
  const date = toDate(d);
  return date ? format(date, 'h:mm a') : '—';
}

/** Oct 8, 2026, 10:05 AM */
export function formatDateTime(d: DateLike) {
  const date = toDate(d);
  return date ? format(date, 'MMM d, yyyy, h:mm a') : '—';
}

/** Oct 8, 2026 · 9:00–11:00 AM, or Oct 8, 9:00 AM – Oct 9, 5:00 PM across days. */
export function formatEventWindow(start: DateLike, end: DateLike) {
  const from = toDate(start);
  const to = toDate(end);
  if (!from) return 'No start time';
  if (!to) return `${format(from, 'MMM d, yyyy')} · ${format(from, 'h:mm a')}`;
  if (!isSameDay(from, to)) {
    return `${format(from, 'MMM d, h:mm a')} – ${format(to, 'MMM d, h:mm a')}`;
  }
  const sameHalf = format(from, 'a') === format(to, 'a');
  const times = sameHalf
    ? `${format(from, 'h:mm')}–${format(to, 'h:mm a')}`
    : `${format(from, 'h:mm a')} – ${format(to, 'h:mm a')}`;
  return `${format(from, 'MMM d, yyyy')} · ${times}`;
}

export function personName(
  person?: { first_name?: string | null; last_name?: string | null } | null
) {
  return [person?.first_name, person?.last_name].filter(Boolean).join(' ');
}

export const plural = (n: number, one: string, many: string) =>
  `${n.toLocaleString()} ${n === 1 ? one : many}`;
