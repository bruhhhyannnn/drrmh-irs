import assert from 'node:assert/strict';
import { test } from 'node:test';
import { categoryFromParam, clusterOptions, filterByCategory } from './category-filter';

const campus = {
  id: 'a',
  category: 'campus' as const,
  cluster: { id: 'k2', name: 'Padre Faura' },
};
const campus2 = {
  id: 'b',
  category: 'campus' as const,
  cluster: { id: 'k1', name: 'Diliman' },
};
const off = { id: 'c', category: 'off_campus' as const, cluster: null };
const ROWS = [campus, off, campus2];

test('filterByCategory returns only the requested category', () => {
  assert.deepEqual(filterByCategory(ROWS, 'campus'), [campus, campus2]);
  assert.deepEqual(filterByCategory(ROWS, 'off_campus'), [off]);
});

test('filterByCategory keeps everything for all', () => {
  assert.deepEqual(filterByCategory(ROWS, 'all'), ROWS);
});

test('clusterOptions has no empty entry and is sorted by name', () => {
  assert.deepEqual(clusterOptions(ROWS), [
    { id: 'k1', name: 'Diliman' },
    { id: 'k2', name: 'Padre Faura' },
  ]);
});

test('clusterOptions lists a cluster once', () => {
  assert.equal(clusterOptions([campus, campus]).length, 1);
});

test('the pages open on Campus unless the URL says otherwise', () => {
  assert.equal(categoryFromParam(null), 'campus');
  assert.equal(categoryFromParam('nonsense'), 'campus');
  assert.equal(categoryFromParam('off_campus'), 'off_campus');
  assert.equal(categoryFromParam('all'), 'all');
});
