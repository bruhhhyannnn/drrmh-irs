import assert from 'node:assert/strict';
import { test } from 'node:test';
import { MATATAG_2025_07_25 } from '../../prisma/data/matatag-2025-07-25';
import {
  canPublishTemplate,
  moveItemInSection,
  orderSectionItems,
  pillarItemCounts,
  templateFromData,
} from './assessment-template';

const T = templateFromData(MATATAG_2025_07_25);

test('pillarItemCounts matches the spec partition (149 / 24 / 37 / 1)', () => {
  assert.deepEqual(pillarItemCounts(T.sections), {
    'prevention-mitigation': 149,
    preparedness: 24,
    response: 37,
    'rehabilitation-recovery': 1,
  });
});

test('orderSectionItems keeps sub-items right after their group parent', () => {
  const raw = [
    { id: '1', parent_id: null, sort_order: 0 },
    { id: '2', parent_id: null, sort_order: 1 },
    { id: '3', parent_id: null, sort_order: 2 },
    { id: '2.2', parent_id: '2', sort_order: 20 },
    { id: '2.1', parent_id: '2', sort_order: 10 },
  ];
  assert.deepEqual(
    orderSectionItems(raw).map((i) => [i.id, i.sort_order]),
    [
      ['1', 0],
      ['2', 1],
      ['2.1', 2],
      ['2.2', 3],
      ['3', 4],
    ]
  );
});

test('moveItemInSection moves a group parent with its sub-items, and moves sub-items within their group', () => {
  const items = orderSectionItems([
    { id: '1', parent_id: null, sort_order: 0 },
    { id: '2', parent_id: null, sort_order: 1 },
    { id: '2.1', parent_id: '2', sort_order: 2 },
    { id: '2.2', parent_id: '2', sort_order: 3 },
    { id: '3', parent_id: null, sort_order: 4 },
  ]);

  assert.deepEqual(
    moveItemInSection(items, '2', 'down').map((i) => i.id),
    ['1', '3', '2', '2.1', '2.2']
  );
  assert.deepEqual(
    moveItemInSection(items, '2.2', 'up').map((i) => i.id),
    ['1', '2', '2.2', '2.1', '3']
  );
  // Boundary moves are no-ops.
  assert.deepEqual(
    moveItemInSection(items, '1', 'up').map((i) => i.id),
    ['1', '2', '2.1', '2.2', '3']
  );
  assert.deepEqual(
    moveItemInSection(items, '2.1', 'up').map((i) => i.id),
    ['1', '2', '2.1', '2.2', '3']
  );
});

test('canPublishTemplate requires at least one scored question and a pillar on every scored question', () => {
  assert.deepEqual(canPublishTemplate(T.sections), { ok: true });
  assert.deepEqual(canPublishTemplate([]), {
    ok: false,
    error: 'Add at least one scored question before publishing.',
  });
  assert.deepEqual(
    canPublishTemplate([
      {
        code: 'I',
        items: [{ code: '2', is_scored: true, pillar_code: null }],
      },
    ]),
    {
      ok: false,
      error: 'I.2 needs a DRRM pillar before this version can be published.',
    }
  );
});
