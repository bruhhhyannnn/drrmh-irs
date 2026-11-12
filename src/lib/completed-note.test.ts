import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  completedNoteKey,
  initialNote,
  memoryOnStart,
  readNoteMemory,
  secondsLeft,
} from './completed-note';

test('the first visit opens the note and counts down', () => {
  assert.deepEqual(initialNote(null), { open: true, countdown: true });
});

test('later visits follow the remembered choice, without a countdown', () => {
  assert.deepEqual(initialNote('closed'), { open: false, countdown: false });
  assert.deepEqual(initialNote('open'), { open: true, countdown: false });
});

test('a first visit is remembered as minimized; a kept choice stays', () => {
  assert.equal(memoryOnStart(null), 'closed');
  assert.equal(memoryOnStart('open'), 'open');
  assert.equal(memoryOnStart('closed'), 'closed');
});

test('the key is per event', () => {
  assert.equal(completedNoteKey('e1'), 'irs.completedNote.e1');
});

test('no storage (as on the server) reads as a first visit', () => {
  assert.equal(readNoteMemory('e1'), null);
});

test('seconds left round up, never below zero', () => {
  assert.equal(secondsLeft(8000), 8);
  assert.equal(secondsLeft(5100), 6);
  assert.equal(secondsLeft(0), 0);
  assert.equal(secondsLeft(-50), 0);
});
