import assert from 'node:assert/strict';
import { test } from 'node:test';
import { swipedStep } from './section-swipe';

test('swipes go left to next and right to previous, ignoring taps and vertical scrolling', () => {
  assert.equal(swipedStep(-80, 10, 5, 18), 6);
  assert.equal(swipedStep(80, -10, 5, 18), 4);
  assert.equal(swipedStep(0, 0, 5, 18), null);
  assert.equal(swipedStep(47, 0, 5, 18), null);
  assert.equal(swipedStep(50, 100, 5, 18), null);
  assert.equal(swipedStep(-50, -100, 5, 18), null);
  assert.equal(swipedStep(80, 0, 0, 18), 0);
  assert.equal(swipedStep(-80, 0, 18, 18), 18);
});
