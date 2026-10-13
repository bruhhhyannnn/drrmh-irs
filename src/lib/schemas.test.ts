import { describe, expect, it } from 'vitest';
import {
  bystanderMissingPersonSchema,
  bystanderReportSchema,
  eventSchema,
  populationCategorySchema,
  reportSchema,
  toPhContactNumber,
  updatePasswordSchema,
} from './schemas';

const UUID = '6f1c2b8e-3a4d-4e5f-8a9b-0c1d2e3f4a5b';

/** The first error message for a path, or undefined when the value is valid there. */
function errorAt(
  result: { success: boolean; error?: { issues: { path: PropertyKey[]; message: string }[] } },
  path: string
) {
  return result.error?.issues.find((issue) => issue.path.join('.') === path)?.message;
}

describe('toPhContactNumber', () => {
  it.each([
    ['917 123 4567', '+639171234567'],
    ['0917-123-4567', '+639171234567'],
    ['+63 917 123 4567', '+639171234567'],
    ['639171234567', '+639171234567'],
    ['2 8123 4567', '+63281234567'],
  ])('normalises %s to %s', (input, expected) => {
    expect(toPhContactNumber(input)).toBe(expected);
  });

  it.each(['', 'abc', '12345', '1234567890', '917 123 45678 9'])('rejects %j', (input) => {
    expect(toPhContactNumber(input)).toBeNull();
  });
});

describe('bystanderReportSchema', () => {
  const base = {
    incident_type_id: UUID,
    cluster_id: UUID,
    latitude: 14.5779,
    longitude: 120.9846,
  };

  it('fills the defaults for a minimal report', () => {
    const parsed = bystanderReportSchema.parse(base);
    expect(parsed.population_counts).toEqual([]);
    expect(parsed.report_missing_persons).toEqual([]);
    expect(parsed.report_casualties).toEqual([]);
    expect(parsed.contact_number).toBeNull();
  });

  it('stores the contact number in +63 form', () => {
    const parsed = bystanderReportSchema.parse({ ...base, contact_number: '0917 123 4567' });
    expect(parsed.contact_number).toBe('+639171234567');
  });

  it('rejects a contact number that is not Philippine', () => {
    const result = bystanderReportSchema.safeParse({ ...base, contact_number: '555-0100' });
    expect(errorAt(result, 'contact_number')).toBe('Enter a Philippine number, e.g. 917 123 4567');
  });

  it('turns blank optional ids into null', () => {
    const parsed = bystanderReportSchema.parse({ ...base, unit_id: '', damage_condition_id: '' });
    expect(parsed.unit_id).toBeNull();
    expect(parsed.damage_condition_id).toBeNull();
  });

  it('needs a location on the map', () => {
    const result = bystanderReportSchema.safeParse({ ...base, latitude: undefined });
    expect(errorAt(result, 'latitude')).toBe('Please capture your location');
    expect(bystanderReportSchema.safeParse({ ...base, latitude: 91 }).success).toBe(false);
  });
});

describe('bystanderMissingPersonSchema', () => {
  it('reads a blank age as unknown, not 0', () => {
    expect(bystanderMissingPersonSchema.parse({ age: '' })).toEqual({
      name: '',
      age: null,
      sex: 'unknown',
    });
  });

  it('accepts an age typed as text and caps it at 130', () => {
    expect(bystanderMissingPersonSchema.parse({ name: 'Maria', age: '34' }).age).toBe(34);
    expect(bystanderMissingPersonSchema.safeParse({ age: 131 }).success).toBe(false);
  });
});

describe('eventSchema', () => {
  const base = { name: 'Q4 earthquake drill', campus_ids: [UUID], status_id: UUID };

  it('needs a name, a campus and a status', () => {
    const result = eventSchema.safeParse({ name: '  ', campus_ids: [], status_id: '' });
    expect(errorAt(result, 'name')).toBe('Enter an event name.');
    expect(errorAt(result, 'campus_ids')).toBe('Pick at least one campus.');
    expect(errorAt(result, 'status_id')).toBe('Pick a status.');
  });

  it('allows an event without times', () => {
    expect(eventSchema.safeParse(base).success).toBe(true);
  });

  it('needs the end after the start', () => {
    const result = eventSchema.safeParse({
      ...base,
      started_at: '2026-10-08T10:00',
      ended_at: '2026-10-08T09:00',
    });
    expect(errorAt(result, 'ended_at')).toBe('The end must be after the start.');
  });
});

describe('reportSchema', () => {
  it('reads a blank damage condition as none', () => {
    const parsed = reportSchema.parse({
      event_id: UUID,
      cluster_id: UUID,
      damage_condition_id: '',
    });
    expect(parsed.damage_condition_id).toBeNull();
  });
});

describe('updatePasswordSchema', () => {
  it('lists every missing password rule', () => {
    const result = updatePasswordSchema.safeParse({
      password: 'password',
      confirmPassword: 'password',
    });
    const messages = result.error?.issues.map((issue) => issue.message);
    expect(messages).toEqual([
      'Password must contain at least one uppercase letter',
      'Password must contain at least one number',
      'Password must contain at least one special character',
    ]);
  });

  it('needs both passwords to match', () => {
    const result = updatePasswordSchema.safeParse({
      password: 'Str0ng!pass',
      confirmPassword: 'Str0ng!pas',
    });
    expect(errorAt(result, 'confirmPassword')).toBe("Passwords don't match");
  });
});

describe('populationCategorySchema', () => {
  it('only takes lowercase snake_case codes', () => {
    expect(
      populationCategorySchema.safeParse({ code: 'non_academic_staff', name: 'Staff' }).success
    ).toBe(true);
    expect(
      populationCategorySchema.safeParse({ code: 'Non Academic', name: 'Staff' }).success
    ).toBe(false);
  });
});
