const { test, mock } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcrypt');
const { validatePassword, passwordMatches, BCRYPT_ROUNDS } = require('../lib/passwords');

test('new passwords require a long passphrase without silently truncating UTF-8 bytes', () => {
  for (const password of ['short', 'passwordpassword', '123456789012345', 'a'.repeat(20), '🐾'.repeat(19), 'ab'.repeat(37)]) {
    assert.equal(typeof validatePassword(password, { isNew: true }), 'string');
  }
  for (const password of ['correct horse battery staple', '🐾🐈🐕'.repeat(5), '  a memorable passphrase  ']) {
    assert.equal(validatePassword(password, { isNew: true }), null);
  }
  assert.equal(validatePassword('existing-short'), null);
  for (const password of [undefined, null, [], {}, '', '  ']) assert.equal(typeof validatePassword(password), 'string');
});

test('unknown and malformed account hashes still perform a bcrypt comparison', async () => {
  const compare = mock.method(bcrypt, 'compare');
  try {
    assert.equal(await passwordMatches('wrong password', undefined), false);
    assert.equal(await passwordMatches('wrong password', 'invalid-hash'), false);
    assert.equal(compare.mock.callCount(), 2);
    for (const call of compare.mock.calls) assert.equal(bcrypt.getRounds(call.arguments[1]), BCRYPT_ROUNDS);
  } finally {
    compare.mock.restore();
  }
});

test('password comparisons preserve spaces and reject incorrect credentials', async () => {
  const password = '  a memorable passphrase  ';
  const hash = await bcrypt.hash(password, 4);
  assert.equal(await passwordMatches(password, hash), true);
  assert.equal(await passwordMatches(password.trim(), hash), false);
});
