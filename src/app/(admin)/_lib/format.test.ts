import { describe, expect, it } from 'vitest';
import { formatDate, formatDateTime, formatEventWindow, personName, plural } from './format';

/** A time in Philippine time (the test run's time zone). */
const at = (date: string, time: string) => `${date}T${time}:00+08:00`;

describe('formatEventWindow', () => {
  it('shares AM/PM when both ends are in the same half of the day', () => {
    expect(formatEventWindow(at('2026-10-08', '09:00'), at('2026-10-08', '11:00'))).toBe(
      'Oct 8, 2026 · 9:00–11:00 AM'
    );
  });

  it('spells out both halves across noon', () => {
    expect(formatEventWindow(at('2026-10-08', '09:00'), at('2026-10-08', '13:30'))).toBe(
      'Oct 8, 2026 · 9:00 AM – 1:30 PM'
    );
  });

  it('shows both dates when the event runs past midnight', () => {
    expect(formatEventWindow(at('2026-10-08', '21:00'), at('2026-10-09', '05:00'))).toBe(
      'Oct 8, 9:00 PM – Oct 9, 5:00 AM'
    );
  });

  it('handles a missing end or start', () => {
    expect(formatEventWindow(at('2026-10-08', '09:00'), null)).toBe('Oct 8, 2026 · 9:00 AM');
    expect(formatEventWindow(null, null)).toBe('No start time');
  });
});

describe('dates and names', () => {
  it('formats dates and shows a dash when there is none', () => {
    expect(formatDate(at('2026-10-08', '09:00'))).toBe('Oct 8, 2026');
    expect(formatDateTime(at('2026-10-08', '10:05'))).toBe('Oct 8, 2026, 10:05 AM');
    expect(formatDate(null)).toBe('—');
  });

  it('joins the parts of a name that are set', () => {
    expect(personName({ first_name: 'Juan', last_name: 'Cruz' })).toBe('Juan Cruz');
    expect(personName({ first_name: 'Juan', last_name: null })).toBe('Juan');
    expect(personName(null)).toBe('');
  });

  it('picks singular or plural', () => {
    expect(plural(1, 'report', 'reports')).toBe('1 report');
    expect(plural(3, 'report', 'reports')).toBe('3 reports');
  });
});
