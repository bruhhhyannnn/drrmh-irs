import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  assessmentSections,
  emptyMatatag,
  matatagAnswerLabel,
  matatagCompletionErrors,
  matatagScore,
  matatagSections,
  matatagTotals,
  withCalculatedScores,
} from '../src/lib/matatag';
import {
  canSaveMatatagCampus,
  canSubmitMatatagForm,
  matatagAccessScope,
  matatagAssignedOrganization,
} from '../src/lib/matatag-access';
import { defaultMatatagTemplate, matatagTemplateSchema } from '../src/lib/matatag-template';
import { matatagDocumentSchema } from '../src/lib/schemas';

test('record authorization scopes ERT ownership, administrators by campus, and super admins globally', () => {
  const user = { id: 'evaluator-a', campus_id: 'campus-a', user_type: { name: 'ERT Member' } };
  assert.deepEqual(matatagAccessScope(user), { user_id: 'evaluator-a' });
  assert.equal(canSaveMatatagCampus(user, 'campus-b'), false);
  assert.equal(canSaveMatatagCampus(user, 'campus-a'), true);
  user.user_type.name = 'Administrator';
  assert.deepEqual(matatagAccessScope(user), { campus_id: 'campus-a' });
  assert.equal(canSaveMatatagCampus(user, 'campus-b'), false);
  assert.deepEqual(matatagAccessScope({ ...user, campus_id: null }), { user_id: 'evaluator-a' });
  assert.equal(canSaveMatatagCampus({ ...user, campus_id: null }, 'campus-a'), false);
  user.user_type.name = 'Super Admin';
  assert.deepEqual(matatagAccessScope(user), {});
  assert.equal(canSaveMatatagCampus(user, 'campus-b'), false);
  assert.equal(canSaveMatatagCampus(user, 'campus-a'), true);
  assert.equal(canSaveMatatagCampus({ ...user, campus_id: null }, 'campus-b'), true);
  assert.equal(canSaveMatatagCampus(user, ''), false);
  assert.equal(
    matatagAssignedOrganization({
      ...user,
      cluster: null,
      unit: { name: 'Unit A', cluster: { name: 'College A' } },
    }),
    'College A'
  );
});

test('assessment phases and assigned-user forms enforce their audience', () => {
  const document = emptyMatatag();
  assert.equal(document.details.phase, 'PRE');
  const user = { id: 'user-a', campus_id: 'campus-a', user_type: { name: 'ERT Member' } };
  const form = {
    campus_id: 'campus-a',
    access_mode: 'ASSIGNED',
    is_open: true,
    assignments: [{ user_id: 'user-a' }],
  };
  assert.equal(canSubmitMatatagForm(user, form), true);
  assert.equal(canSubmitMatatagForm({ ...user, id: 'user-b' }, form), false);
  assert.equal(canSubmitMatatagForm(user, { ...form, is_open: false }), false);
});

test('the source checklist retains all sections, response items, and starred questions', () => {
  assert.equal(matatagSections.length, 17);
  const ids = matatagSections.flatMap((s) => s.items.map((i) => i.id));
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(matatagTotals(emptyMatatag()).total, 136);
  assert.deepEqual(
    matatagSections.flatMap((s) => s.items.filter((i) => i.starred).map((i) => i.id)),
    ['II-3', 'VI-1', 'VI-9']
  );
  assert.match(matatagSections[0].items.find((i) => i.id === 'I-8')!.text, /Makikita ba/);
  assert.match(matatagSections[9].items.find((i) => i.id === 'X-3')!.text, /Maayos bang/);
});

test('N/A sections override counts without destroying answers or double-counting groups', () => {
  const document = emptyMatatag();
  document.answers = { 'I-1': 'YES', 'I-2': 'NO', 'I-3.1': 'NA' };
  assert.deepEqual(matatagTotals(document, 'I'), {
    YES: 1,
    NO: 1,
    NA: 0,
    unanswered: 7,
    total: 9,
  });
  document.sections.I = { notApplicable: true, score: '', comments: '' };
  assert.deepEqual(matatagTotals(document, 'I'), {
    YES: 0,
    NO: 0,
    NA: 9,
    unanswered: 0,
    total: 9,
  });
  document.sections.I.notApplicable = false;
  assert.equal(matatagTotals(document, 'I').YES, 1);
  assert.equal(document.answers['I-2'], 'NO');
});

test('validation rejects unknown questions, group answers, invalid dates and fractional counts', () => {
  const document = emptyMatatag();
  assert.equal(matatagDocumentSchema.safeParse(document).success, true);
  for (const answers of [{ 'I-999': 'YES' }, { 'I-3': 'YES' }, { 'I-1': 'MAYBE' }]) {
    assert.equal(matatagDocumentSchema.safeParse({ ...document, answers }).success, false);
  }
  for (const details of [
    { date: '2026-02-30' },
    { buildingCount: '1.5' },
    { floorCount: '-1' },
    { timeStart: '24:00' },
  ]) {
    assert.equal(
      matatagDocumentSchema.safeParse({ ...document, details: { ...document.details, ...details } })
        .success,
      false
    );
  }
});

test('a completed assessment requires metadata and all responses, but never an invented score', () => {
  const document = emptyMatatag();
  assert.ok(matatagCompletionErrors(document).length > 1);
  Object.assign(document.details, {
    campusId: 'c1b8f8c0-b67c-47e2-ad1f-9d6f66161ca4',
    campus: 'Test campus',
    unit: 'Test unit',
    buildings: 'Test building',
    buildingCount: '1',
    floorCount: '3',
    commander: 'Test commander',
    evaluator: 'Test evaluator',
    date: '2026-09-15',
    timeStart: '08:00',
    timeEnd: '10:00',
  });
  for (const s of matatagSections)
    document.sections[s.id] = { notApplicable: true, score: '', comments: '' };
  assert.deepEqual(matatagCompletionErrors(document), []);
  assert.equal(matatagDocumentSchema.safeParse(document).success, true);
  document.sections.I.notApplicable = false;
  assert.match(matatagCompletionErrors(document)[0], /12 checklist questions/);
});

test('grouped questions derive one result from their subquestions', () => {
  const document = emptyMatatag();
  document.answers = {
    'I-1': 'YES',
    'I-2': 'YES',
    'I-3.1': 'YES',
    'I-3.2': 'YES',
    'I-3.3': 'YES',
    'I-3.4': 'NO',
  };
  const group = assessmentSections(document)[0].items.find((item) => item.id === 'I-3')!;
  assert.equal(matatagAnswerLabel(document, 'I', group, 'en'), 'No');
  assert.deepEqual(matatagTotals(document, 'I'), {
    YES: 2,
    NO: 1,
    NA: 0,
    unanswered: 6,
    total: 9,
  });
  assert.equal(matatagScore(document, 'I'), '67%');
  document.answers['I-3.4'] = 'YES';
  assert.equal(matatagAnswerLabel(document, 'I', group, 'en'), 'Yes');
  assert.equal(matatagScore(document, 'I'), '100%');
});

test('system score credits positive YES and starred negative NO, with N/A in the denominator', () => {
  const document = emptyMatatag();
  document.answers = { 'II-1': 'YES', 'II-2': 'NO', 'II-3': 'YES' };
  assert.equal(matatagScore(document, 'II'), '33%');
  document.answers['II-3'] = 'NO';
  assert.equal(matatagScore(document, 'II'), '67%');
  document.answers['II-2'] = 'NA';
  assert.equal(matatagScore(document, 'II'), '67%');
  document.sections.II = { notApplicable: true, score: '999', comments: '' };
  assert.equal(matatagScore(document, 'II'), '0%');
  const canonical = withCalculatedScores(document);
  assert.equal(canonical.sections.II.score, '0%');
  assert.equal(canonical.details.overallScore, '0%');
});

test('edited checklists drive validation, custom options, scoring, and preserve older drafts', () => {
  const definition = structuredClone(defaultMatatagTemplate);
  definition.sections = [definition.sections[0]];
  const section = definition.sections[0];
  section.items = [section.items[0]];
  section.title = 'Updated safety checks';
  const item = section.items[0];
  item.text.en = 'Is the emergency exit clear?';
  item.options = [
    { value: 'CLEAR', en: 'Clear', fil: 'Maluwag', kind: 'YES' },
    { value: 'BLOCKED', en: 'Blocked', fil: 'May harang', kind: 'NO' },
  ];
  assert.equal(matatagTemplateSchema.safeParse(definition).success, true);
  const document = emptyMatatag({ id: 'ab3b9019-9c73-4f49-b9b1-a9d43c02ac6f', definition });
  assert.equal(matatagTotals(document).total, 1);
  document.answers[item.id] = 'CLEAR';
  assert.equal(matatagDocumentSchema.safeParse(document).success, true);
  assert.equal(matatagScore(document), '100%');
  assert.equal(matatagAnswerLabel(document, section.id, item, 'fil'), 'Maluwag');
  assert.equal(matatagTotals(document).YES, 1);
  document.answers[item.id] = 'YES';
  assert.equal(matatagDocumentSchema.safeParse(document).success, false);
  document.answers[item.id] = 'BLOCKED';
  assert.equal(matatagScore(document), '0%');
  item.starred = true;
  assert.equal(matatagScore(document), '100%');
  document.sections[section.id] = { notApplicable: true, score: '', comments: '' };
  assert.equal(matatagTotals(document).NA, 1);
  assert.equal(matatagScore(document), '0%');
  assert.equal(matatagTotals(emptyMatatag()).total, 136);
  const stored = matatagDocumentSchema.parse(JSON.parse(JSON.stringify(document)));
  definition.sections[0].items[0].text.en = 'Later wording';
  assert.equal(stored.template!.sections[0].items[0].text.en, 'Is the emergency exit clear?');
});

test('template validation rejects empty sections, duplicate IDs, invalid options, and missing snapshots', () => {
  const definition = structuredClone(defaultMatatagTemplate);
  assert.equal(matatagTemplateSchema.safeParse(definition).success, true);
  assert.equal(matatagTemplateSchema.safeParse({ sections: [] }).success, false);
  definition.sections[0].items = [];
  assert.equal(matatagTemplateSchema.safeParse(definition).success, false);
  definition.sections[0].items = structuredClone(defaultMatatagTemplate.sections[0].items);
  definition.sections[0].items[0].options = [{ value: 'YES', en: 'Yes', fil: '', kind: 'YES' }];
  assert.equal(matatagTemplateSchema.safeParse(definition).success, false);
  definition.sections[0].items[0].options.push({
    value: 'YES',
    en: 'Duplicate',
    fil: '',
    kind: 'NO',
  });
  assert.equal(matatagTemplateSchema.safeParse(definition).success, false);
  definition.sections[0].items = structuredClone(defaultMatatagTemplate.sections[0].items);
  definition.sections[1].id = definition.sections[0].id;
  assert.equal(matatagTemplateSchema.safeParse(definition).success, false);
  assert.equal(
    matatagDocumentSchema.safeParse({
      ...emptyMatatag(),
      version: 'ab3b9019-9c73-4f49-b9b1-a9d43c02ac6f',
    }).success,
    false
  );
});
