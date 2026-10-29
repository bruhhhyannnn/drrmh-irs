import assert from 'node:assert/strict';
import { test } from 'node:test';
import { REPORT_PHOTO_BUDGET_BYTES, REPORT_PHOTO_FIELD } from './constants';
import { groupReportPhotos, reportPhotoFiles, toReportPhotoFormData } from './utils';

const blob = (bytes = 10) => new Blob([new Uint8Array(bytes)], { type: 'image/jpeg' });
const names = (files: File[]) => files.map((f) => f.name);

test('report photos are named by where they belong', () => {
  const files = reportPhotoFiles([blob(), blob()], [[], [blob()], [blob(), blob()]]);
  assert.deepEqual(names(files), [
    'damage-1.jpg',
    'damage-2.jpg',
    'casualty-1-1.jpg',
    'casualty-2-1.jpg',
    'casualty-2-2.jpg',
  ]);
  assert.ok(files.every((f) => f.type === 'image/jpeg'));
});

test('report photos keep their names through FormData', () => {
  assert.equal(toReportPhotoFormData([]), undefined);
  const form = toReportPhotoFormData(reportPhotoFiles([blob()], [[blob()]]))!;
  const sent = form.getAll(REPORT_PHOTO_FIELD) as File[];
  assert.deepEqual(names(sent), ['damage-1.jpg', 'casualty-0-1.jpg']);
  // A plain Blob (after submit, one casualty at a time) still gets a name.
  const single = toReportPhotoFormData([blob()])!.getAll(REPORT_PHOTO_FIELD) as File[];
  assert.deepEqual(names(single), ['photo-1.jpg']);
});

test('grouping sorts photos back to the damage answer and each casualty', () => {
  const files = reportPhotoFiles([blob()], [[blob(), blob()], [], [blob()]]);
  const { damage, casualties } = groupReportPhotos(files, 3);
  assert.deepEqual(names(damage), ['damage-1.jpg']);
  assert.deepEqual(casualties.map(names), [
    ['casualty-0-1.jpg', 'casualty-0-2.jpg'],
    [],
    ['casualty-2-1.jpg'],
  ]);
});

test('grouping leaves out unknown names, missing casualties and a fourth photo', () => {
  const files = [
    ...reportPhotoFiles([blob(), blob(), blob(), blob()], [[blob()], [blob()]]),
    new File([blob()], 'photo-1.jpg'),
    new File([blob()], 'casualty-x-1.jpg'),
  ];
  const { damage, casualties } = groupReportPhotos(files, 1);
  assert.equal(damage.length, 3);
  assert.deepEqual(casualties.map(names), [['casualty-0-1.jpg']]);
});

test('grouping stops at the byte budget, in the order sent', () => {
  const big = Math.floor(REPORT_PHOTO_BUDGET_BYTES / 2) - 1;
  const files = reportPhotoFiles([blob(big), blob(big)], [[blob(big), blob(1)]]);
  const { damage, casualties } = groupReportPhotos(files, 1);
  assert.equal(damage.length, 2);
  // The third large photo would pass the budget; the small one after it still fits.
  assert.deepEqual(casualties.map(names), [['casualty-0-2.jpg']]);
});
