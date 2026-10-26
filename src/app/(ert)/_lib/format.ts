// Date and time text for the ERT pages, e.g. "Oct 8, 2026 · 9:14 AM".

const DATE = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const SHORT_DATE = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const TIME = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit' });

type DateLike = Date | string | number;

/** "9:14 AM" */
export function formatTime(value: DateLike) {
  return TIME.format(new Date(value));
}

/** "Oct 8, 2026 · 9:14 AM" */
export function formatDateTime(value: DateLike) {
  const date = new Date(value);
  return `${DATE.format(date)} · ${TIME.format(date)}`;
}

/** "Oct 8, 9:00 AM" */
export function formatShortDateTime(value: DateLike) {
  const date = new Date(value);
  return `${SHORT_DATE.format(date)}, ${TIME.format(date)}`;
}

/** "Oct 8, 2026" */
export function formatDate(value: DateLike) {
  return DATE.format(new Date(value));
}
