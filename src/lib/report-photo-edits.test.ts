import assert from 'node:assert/strict';
import { test } from 'node:test';
import { keptPhotoPaths, mergePhotoPaths, newPhotoRoom } from './report-photo-edits';

test('keep unset keeps every saved photo', () => {
  assert.deepEqual(keptPhotoPaths(['r/a.jpg', 'r/b.jpg'], undefined), ['r/a.jpg', 'r/b.jpg']);
});

test('keep only keeps the place’s own photos, in their saved order', () => {
  assert.deepEqual(keptPhotoPaths(['r/a.jpg', 'r/b.jpg'], ['r/b.jpg', 'other/x.jpg', 'r/a.jpg']), [
    'r/a.jpg',
    'r/b.jpg',
  ]);
  assert.deepEqual(keptPhotoPaths(['r/a.jpg'], []), []);
});

test('room for new photos counts only the kept ones', () => {
  assert.equal(newPhotoRoom(['a', 'b', 'c'], undefined), 0);
  assert.equal(newPhotoRoom(['a', 'b', 'c'], ['a']), 2);
  assert.equal(newPhotoRoom([], undefined), 3);
});

test('merge keeps, adds the uploads and deletes what was taken off', () => {
  assert.deepEqual(mergePhotoPaths(['a', 'b'], ['b'], ['n1']), {
    paths: ['b', 'n1'],
    removed: ['a'],
  });
});

test('uploads past three photos are deleted, not saved', () => {
  assert.deepEqual(mergePhotoPaths(['a', 'b'], undefined, ['n1', 'n2']), {
    paths: ['a', 'b', 'n1'],
    removed: ['n2'],
  });
});

test('a new casualty has nothing saved: its uploads are its photos', () => {
  assert.deepEqual(mergePhotoPaths([], undefined, ['n1']), { paths: ['n1'], removed: [] });
});
