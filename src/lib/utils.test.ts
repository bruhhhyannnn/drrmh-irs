import { describe, expect, it } from 'vitest';
import { BYSTANDER_PHOTO_FIELD, isAdminUserType } from './constants';
import {
  getInitials,
  mapPopulationCountsToLegacyColumns,
  sumPopulationCountsByCategory,
  toBystanderPhotoFormData,
  toSettingsPath,
  totalPopulationCount,
  uniquePopulationCategories,
} from './utils';

const students = { id: 'c-students', name: 'Students' };
const faculty = { id: 'c-faculty', name: 'Faculty Members' };

const reports = [
  {
    population_counts: [
      { count: 6, category: students },
      { count: 1, category: faculty },
    ],
  },
  { population_counts: [{ count: 4, category: students }] },
];

describe('isAdminUserType', () => {
  it('treats Administrator and Super Admin as admins', () => {
    expect(isAdminUserType('Administrator')).toBe(true);
    expect(isAdminUserType('Super Admin')).toBe(true);
  });

  it.each(['ERT Member', 'administrator', '', null, undefined])(
    'treats %j as not an admin',
    (type) => {
      expect(isAdminUserType(type)).toBe(false);
    }
  );
});

describe('population counts', () => {
  it('adds up every count', () => {
    expect(totalPopulationCount([{ count: 6 }, { count: 1 }, { count: 4 }])).toBe(11);
    expect(totalPopulationCount([])).toBe(0);
  });

  it('sums per category in the order categories first appear', () => {
    expect(sumPopulationCountsByCategory(reports)).toEqual([
      { ...students, total: 10 },
      { ...faculty, total: 1 },
    ]);
  });

  it('lists each category once', () => {
    expect(uniquePopulationCategories(reports)).toEqual([students, faculty]);
  });

  it('keeps only the original 12 codes for the legacy columns', () => {
    expect(
      mapPopulationCountsToLegacyColumns([
        { code: 'students', count: 6 },
        { code: 'faculty_members', count: 1 },
        { code: 'volunteers', count: 3 },
      ])
    ).toEqual({ students: 6, faculty_members: 1 });
  });
});

describe('getInitials', () => {
  it('takes the first letter of each word', () => {
    expect(getInitials('juan  dela cruz')).toBe('JDC');
    expect(getInitials('')).toBe('');
  });
});

describe('toSettingsPath', () => {
  it('turns a tab title into its settings route', () => {
    expect(toSettingsPath('Casualty Conditions')).toBe('/settings/casualty-conditions');
  });
});

describe('toBystanderPhotoFormData', () => {
  it('is undefined without photos', () => {
    expect(toBystanderPhotoFormData(undefined)).toBeUndefined();
    expect(toBystanderPhotoFormData([])).toBeUndefined();
  });

  it('packs each photo under the photos field as a numbered JPEG', () => {
    const photos = [
      new Blob(['a'], { type: 'image/jpeg' }),
      new Blob(['b'], { type: 'image/jpeg' }),
    ];
    const sent = toBystanderPhotoFormData(photos)!.getAll(BYSTANDER_PHOTO_FIELD) as File[];
    expect(sent.map((file) => file.name)).toEqual(['photo-1.jpg', 'photo-2.jpg']);
  });
});
