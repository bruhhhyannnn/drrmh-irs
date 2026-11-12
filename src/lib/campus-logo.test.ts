import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CAMPUS_LOGO_MAX_BYTES, CAMPUS_LOGO_TYPES, campusLogo, ownCampusLogo } from './campus-logo';

test('an uploaded logo comes first, then the bundled file, then the UP seal', () => {
  assert.equal(campusLogo('UP Manila', 'https://x/logo.png'), 'https://x/logo.png');
  assert.equal(campusLogo('UP Manila'), '/up-manila-logo.png');
  assert.equal(campusLogo('UP Manila', null), '/up-manila-logo.png');
  assert.equal(campusLogo('PGH'), '/up-logo.png');
  assert.equal(ownCampusLogo('PGH'), null);
  assert.equal(ownCampusLogo('PGH', 'https://x/pgh.webp'), 'https://x/pgh.webp');
});

test('logo uploads take PNG or WebP up to 1 MB', () => {
  assert.deepEqual([...CAMPUS_LOGO_TYPES], ['image/png', 'image/webp']);
  assert.equal(CAMPUS_LOGO_MAX_BYTES, 1048576);
});
