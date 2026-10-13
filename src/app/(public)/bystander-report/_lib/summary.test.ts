import { describe, expect, it } from 'vitest';
import { formatCoordinates, headcountSummary, peopleSummary, photosLabel } from './summary';

const conditionName = (id: string) => (id === 'minor' ? 'Minor' : 'Serious');

describe('review step summaries', () => {
  it('formats coordinates with hemispheres', () => {
    expect(formatCoordinates(14.57791, 120.98462)).toBe('14.5779° N, 120.9846° E');
    expect(formatCoordinates(-33.8688, -70.6693)).toBe('33.8688° S, 70.6693° W');
  });

  it('summarises missing persons and casualties', () => {
    expect(peopleSummary([], [], conditionName)).toBeNull();
    expect(
      peopleSummary(
        [],
        [{ name: '', age: null, sex: 'unknown', condition_id: 'minor' }],
        conditionName
      )
    ).toBe('No missing persons · 1 casualty (Minor)');
    expect(peopleSummary([{ name: 'Maria', age: 34, sex: 'female' }], [], conditionName)).toBe(
      '1 missing person · No casualties'
    );
  });

  it('lists the headcount largest first and leaves out zeros', () => {
    expect(headcountSummary([{ name: 'Students', count: 0 }])).toBeNull();
    expect(
      headcountSummary([
        { name: 'Faculty Members', count: 1 },
        { name: 'Guests', count: 0 },
        { name: 'Students', count: 6 },
      ])
    ).toBe('7 people · Students 6, Faculty Members 1');
  });

  it('counts photos', () => {
    expect(photosLabel(0)).toBe('None');
    expect(photosLabel(1)).toBe('1 photo');
    expect(photosLabel(3)).toBe('3 photos');
  });
});
