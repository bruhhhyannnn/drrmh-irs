import { describe, expect, it } from 'vitest';
import { casualtiesMeta, conditionSummary, missingPersonsMeta, personMeta } from './people';

const CONDITIONS: Record<string, string> = { minor: 'Minor', serious: 'Serious' };
const conditionName = (id: string) => CONDITIONS[id];

describe('personMeta', () => {
  it('shows only the details that are known', () => {
    expect(
      personMeta({ name: 'Maria', age: 34, sex: 'female', diagnosis: ' Cut on the left arm ' })
    ).toBe('Female · 34 yrs · Cut on the left arm');
    expect(personMeta({ name: '', age: 0, sex: 'unknown' })).toBe('0 yrs');
    expect(personMeta({ name: '', age: null, sex: 'unknown', diagnosis: '  ' })).toBe(
      'No details added'
    );
  });
});

describe('conditionSummary', () => {
  it('names the condition of a single casualty', () => {
    expect(conditionSummary([{ condition_id: 'minor' }], conditionName)).toBe('Minor');
  });

  it('tallies several casualties by condition', () => {
    const casualties = [
      { condition_id: 'minor' },
      { condition_id: 'serious' },
      { condition_id: 'minor' },
    ];
    expect(conditionSummary(casualties, conditionName)).toBe('2 Minor, 1 Serious');
  });
});

describe('row meta lines', () => {
  it('summarises casualties', () => {
    expect(casualtiesMeta([], conditionName)).toBe('None added');
    expect(casualtiesMeta([{ condition_id: 'serious' }], conditionName)).toBe(
      '1 casualty · Serious'
    );
  });

  it('names missing persons, unknown ones included', () => {
    expect(missingPersonsMeta([])).toBe('None added');
    expect(missingPersonsMeta([{ name: 'Maria Santos' }, { name: '' }])).toBe(
      '2 people · Maria Santos, Unknown person'
    );
  });
});
