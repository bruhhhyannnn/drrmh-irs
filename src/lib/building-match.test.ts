import assert from 'node:assert/strict';
import { test } from 'node:test';
import { matchBuildingByName } from './building-match';

const rows = [
  { id: 'a', name: 'Annex' },
  { id: 'b', name: 'Main Hall' },
];

test('matches ignoring case and surrounding spaces', () => {
  assert.equal(matchBuildingByName(rows, ' annex ')?.id, 'a');
  assert.equal(matchBuildingByName(rows, 'MAIN HALL')?.id, 'b');
});

test('no match gives null', () => {
  assert.equal(matchBuildingByName(rows, 'Annex 2'), null);
  assert.equal(matchBuildingByName([], 'Annex'), null);
});
