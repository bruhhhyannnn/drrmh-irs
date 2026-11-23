import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isNewestAssessment } from './building-profile';

const ENDED = '2026-05-10T09:00:00.000Z';
const latest = new Date('2026-05-10T09:00:00.000Z');

test('the first assessment of a building is the newest', () => {
  assert.equal(isNewestAssessment(ENDED, null), true);
});

test('an assessment that ended after the newest saved one is newest', () => {
  assert.equal(isNewestAssessment('2026-05-11T08:00:00.000Z', latest), true);
});

test('an assessment that ended at the same time as the newest counts as newest', () => {
  assert.equal(isNewestAssessment(ENDED, latest), true);
});

test('an older assessment, synced late from an offline queue, is not newest', () => {
  assert.equal(isNewestAssessment('2026-05-09T23:59:59.999Z', latest), false);
});

test('accepts a Date as well as an ISO string for the end time', () => {
  assert.equal(isNewestAssessment(new Date(ENDED), latest), true);
  assert.equal(isNewestAssessment(new Date('2026-05-01T00:00:00.000Z'), latest), false);
});
