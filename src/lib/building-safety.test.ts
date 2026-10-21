import assert from 'node:assert/strict';
import { test } from 'node:test';
import { pointsChange, scoresFromPillarRows } from './building-safety';

test('pillar rows add up to the overall score', () => {
  const s = scoresFromPillarRows([
    { code: 'prevention-mitigation', safe_count: 17, counted_count: 19, na_count: 0 },
    { code: 'preparedness', safe_count: 13, counted_count: 13, na_count: 1 },
    { code: 'response', safe_count: 9, counted_count: 9, na_count: 0 },
    { code: 'rehabilitation-recovery', safe_count: 1, counted_count: 1, na_count: 0 },
  ]);
  assert.deepEqual(s.overall, { safe: 40, counted: 42, na: 1 });
  assert.deepEqual(s.pillars.preparedness, { safe: 13, counted: 13, na: 1 });
  assert.deepEqual(scoresFromPillarRows([]).pillars.response, { safe: 0, counted: 0, na: 0 });
});

test('change is in points, and nothing counted means no change', () => {
  assert.equal(pointsChange({ safe: 5, counted: 10, na: 0 }, { safe: 8, counted: 10, na: 0 }), 30);
  assert.equal(pointsChange({ safe: 8, counted: 10, na: 0 }, { safe: 5, counted: 10, na: 0 }), -30);
  assert.equal(pointsChange(null, { safe: 1, counted: 1, na: 0 }), null);
  assert.equal(pointsChange({ safe: 0, counted: 0, na: 3 }, { safe: 1, counted: 1, na: 0 }), null);
});
