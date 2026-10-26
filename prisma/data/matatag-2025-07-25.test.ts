import {
  itemLabel,
  PILLAR_CODES,
  STRUCTURAL_FLAG,
  templateFromData,
} from '@/lib/assessment-template';
import { PILLARS } from '@/lib/pillars';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MATATAG_2025_07_25 } from './matatag-2025-07-25';

// The checklist data checked against the spec (docs/plan/feature/DRRM-015-assessment-form.md,
// Sections 3, 4.1 and 7): section and pillar counts, gating and the reverse-scored items.

const T = templateFromData(MATATAG_2025_07_25);
const items = T.sections.flatMap((s) => s.items.map((i) => ({ ...i, label: itemLabel(s, i) })));
const scored = items.filter((i) => i.is_scored);
const labels = (list: typeof items) => list.map((i) => i.label).sort();
const range = (prefix: string, from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, k) => `${prefix}${from + k}`);

test('17 sections, 211 scored items, counts per section', () => {
  assert.deepEqual(
    T.sections.map((s) => s.code),
    [
      'I',
      'II',
      'III',
      'IV',
      'V',
      'VI',
      'VII',
      'VIII',
      'IX',
      'X',
      'XI',
      'XII',
      'XIII',
      'XIV',
      'XV',
      'XVI',
      'XVII',
    ]
  );
  const per = Object.fromEntries(
    T.sections.map((s) => [s.code, s.items.filter((i) => i.is_scored).length])
  );
  assert.deepEqual(per, {
    I: 12,
    II: 7,
    III: 15,
    IV: 22,
    V: 25,
    VI: 33,
    VII: 7,
    VIII: 8,
    IX: 7,
    X: 3,
    XI: 5,
    XII: 9,
    XIII: 16,
    XIV: 13,
    XV: 5,
    XVI: 4,
    XVII: 20,
  });
  assert.equal(scored.length, 211);
});

test('13 group parents, unscored and without a pillar', () => {
  const groups = items.filter((i) => !i.is_scored);
  assert.deepEqual(
    labels(groups),
    [
      'I.3',
      'III.2',
      'III.4',
      'IV.1',
      'IV.2',
      'IV.3',
      'V.5',
      'V.6',
      'V.7',
      'VI.1',
      'VI.2',
      'VI.7',
      'VI.8',
    ].sort()
  );
  assert.ok(groups.every((g) => g.pillar_code === null));
});

test('every scored item has one pillar: 149 / 24 / 37 / 1', () => {
  assert.ok(scored.every((i) => i.pillar_code !== null));
  const of = (code: string) => labels(scored.filter((i) => i.pillar_code === code));
  assert.deepEqual(
    of('preparedness'),
    [
      'I.1',
      'I.2',
      'I.3.1',
      'I.3.2',
      'I.3.4',
      'I.4',
      'I.5',
      'I.6',
      'I.7',
      'I.8',
      'V.1',
      'V.2',
      'V.4',
      ...range('V.7.', 1, 7),
      'XIII.14',
      'XVII.1',
      'XVII.4',
      'XVII.16',
    ].sort()
  );
  assert.deepEqual(
    of('response'),
    [
      'I.9',
      ...range('III.2.', 1, 6),
      'V.3',
      ...range('V.5.', 1, 7),
      'VII.3',
      ...range('VIII.', 1, 6),
      'VIII.8',
      'XI.5',
      'XII.9',
      'XIII.3',
      'XIII.6',
      'XIII.7',
      'XIII.8',
      'XIII.12',
      'XIII.13',
      'XVI.2',
      'XVII.6',
      'XVII.12',
      'XVII.17',
      'XVII.19',
      'XVII.20',
    ].sort()
  );
  assert.deepEqual(of('rehabilitation-recovery'), ['I.3.3']);
  assert.equal(of('prevention-mitigation').length, 149);
});

test('pillar codes are the DRRM-014 PILLARS slugs, in order', () => {
  assert.deepEqual(
    PILLARS.map((p) => p.slug),
    [...PILLAR_CODES]
  );
});

test('reverse-scored, sprinkler and structural-flag items', () => {
  assert.deepEqual(
    labels(scored.filter((i) => i.safe_answer === 'no')),
    ['II.3', ...range('VI.1.', 1, 7), 'VI.9'].sort()
  );
  assert.deepEqual(
    labels(scored.filter((i) => i.min_floors === 3)),
    [...range('V.6.', 1, 7), 'XVII.13'].sort()
  );
  assert.deepEqual(
    labels(scored.filter((i) => i.flag_label === STRUCTURAL_FLAG)),
    range('VI.1.', 1, 7).sort()
  );
});

test('area gating of sections and sub-items', () => {
  const sectionAreas = Object.fromEntries(
    T.sections.filter((s) => s.area_type_id).map((s) => [s.code, s.area_type_id])
  );
  assert.deepEqual(sectionAreas, {
    VII: 'stairwells',
    IX: 'bathrooms',
    XI: 'offices',
    XII: 'classrooms',
    XIII: 'laboratories',
    XIV: 'playground',
    XV: 'athletic',
    XVI: 'swimming_pool',
    XVII: 'dormitories',
  });
  const byArea = (code: string) => labels(items.filter((i) => i.area_type_id === code));
  assert.deepEqual(
    byArea('corridors'),
    [
      'III.4.1',
      'IV.1.2',
      'IV.2.1',
      'IV.3.1',
      'V.5.1',
      'V.6.1',
      'V.7.1',
      'VI.1.1',
      'VI.2.1',
      'VI.7.1',
      'VI.8.1',
    ].sort()
  );
  for (const area of [
    'bathrooms',
    'offices',
    'classrooms',
    'laboratories',
    'athletic',
    'dormitories',
  ]) {
    assert.equal(byArea(area).length, 12, area);
  }
  assert.equal(items.find((i) => i.label === 'IV.1.1')?.area_type_id, null);
  assert.deepEqual(
    T.area_types.map((a) => a.code),
    [
      'corridors',
      'bathrooms',
      'offices',
      'classrooms',
      'laboratories',
      'athletic',
      'dormitories',
      'playground',
      'swimming_pool',
      'stairwells',
    ]
  );
});

test('English and Filipino text everywhere', () => {
  assert.ok(
    T.sections.every((s) => s.title_en.trim() && s.title_fil.trim()),
    'section titles'
  );
  assert.ok(
    items.every((i) => i.prompt_en.trim() && i.prompt_fil.trim()),
    'item text'
  );
  assert.ok(
    T.area_types.every((a) => a.name_en.trim() && a.name_fil.trim()),
    'area names'
  );
});
