import { describe, expect, it } from 'vitest';
import { bystanderTone, eventStatusKey, eventTone, userTypeLabel, userTypeTone } from './status';

describe('status colours', () => {
  it.each([
    ['Ongoing', 'ongoing', 'green'],
    ['upcoming', 'upcoming', 'amber'],
    ['Completed', 'completed', 'blue'],
    ['Cancelled', 'other', 'grey'],
  ])('event status %s', (name, key, tone) => {
    expect(eventStatusKey(name)).toBe(key);
    expect(eventTone(name)).toBe(tone);
  });

  it.each([
    [null, 'amber'],
    ['Pending', 'amber'],
    ['Verified', 'green'],
    ['Reviewed', 'blue'],
    ['Dismissed', 'grey'],
  ])('bystander status %s', (name, tone) => {
    expect(bystanderTone(name)).toBe(tone);
  });

  it('shortens user types', () => {
    expect(userTypeLabel('ERT Member')).toBe('ERT');
    expect(userTypeLabel('Administrator')).toBe('Admin');
    expect(userTypeLabel('Super Admin')).toBe('Super Admin');
    expect(userTypeLabel(null)).toBe('—');
    expect(userTypeTone('Super Admin')).toBe('maroon');
    expect(userTypeTone('ERT Member')).toBe('neutral');
  });
});
