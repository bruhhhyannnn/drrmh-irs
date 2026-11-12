import assert from 'node:assert/strict';
import { test } from 'node:test';
import { googlePhoto } from './google-photo';

const google = { app_metadata: { provider: 'google', providers: ['google'] } };
const PHOTO = 'https://lh3.googleusercontent.com/a/abc=s96-c';

test('a Google account gives its avatar_url, else its picture', () => {
  assert.equal(googlePhoto({ ...google, user_metadata: { avatar_url: PHOTO } }), PHOTO);
  assert.equal(googlePhoto({ ...google, user_metadata: { picture: PHOTO } }), PHOTO);
});

test('an email and password account has no photo', () => {
  assert.equal(
    googlePhoto({ app_metadata: { provider: 'email' }, user_metadata: { avatar_url: PHOTO } }),
    null
  );
});

test('a photo that is not served by Google over https is ignored', () => {
  assert.equal(
    googlePhoto({ ...google, user_metadata: { avatar_url: 'https://evil.example/x.png' } }),
    null
  );
  assert.equal(
    googlePhoto({ ...google, user_metadata: { avatar_url: 'http://lh3.googleusercontent.com/a' } }),
    null
  );
  assert.equal(googlePhoto({ ...google, user_metadata: { avatar_url: 'not a url' } }), null);
  assert.equal(googlePhoto({ ...google, user_metadata: {} }), null);
});
