const { test } = require('node:test');
const assert = require('node:assert/strict');
const { ensureAuthIndexes } = require('../lib/auth-indexes');

function setup(adapter = 'sails-mongo', failure) {
  const calls = [];
  const datastore = {
    config: { adapter },
    manager: {
      collection(table) {
        return {
          async createIndex(keys, options) {
            calls.push({ table, keys, options });
            if (failure) throw failure;
            return Object.keys(keys)[0] + '_1';
          },
        };
      },
    },
  };
  const model = (tableName) => ({ tableName, getDatastore: () => datastore, attributes: {} });
  return { calls, models: { User: model('user'), AuthSession: model('authsession'), AuthAttempt: model('authattempt') } };
}

test('ensures durable MongoDB account uniqueness and indexed authentication lookups at startup', async () => {
  const { calls, models } = setup();
  await ensureAuthIndexes({ models, production: true });
  assert.deepEqual(calls, [
    { table: 'user', keys: { email: 1 }, options: { name: 'auth_email_unique_ci', unique: true, collation: { locale: 'en', strength: 2 } } },
    { table: 'user', keys: { username: 1 }, options: { unique: true } },
    { table: 'authsession', keys: { userId: 1 }, options: {} },
    { table: 'authsession', keys: { expiresAt: 1 }, options: {} },
    { table: 'authattempt', keys: { bucket: 1 }, options: {} },
    { table: 'authattempt', keys: { expiresAt: 1 }, options: {} },
  ]);
});

test('uses physical database field names when a model maps its attributes', async () => {
  const { calls, models } = setup();
  models.User.attributes.email = { columnName: 'emailAddress' };
  await ensureAuthIndexes({ models, production: true });
  assert.deepEqual(calls[0].keys, { emailAddress: 1 });
});

test('skips development disk indexes but rejects unsupported production stores', async () => {
  const { calls, models } = setup('sails-disk');
  await ensureAuthIndexes({ models });
  assert.deepEqual(calls, []);
  await assert.rejects(ensureAuthIndexes({ models, production: true }), { code: 'E_AUTH_INDEX_SETUP' });
  await assert.rejects(ensureAuthIndexes({ models: setup('unknown').models }), { code: 'E_AUTH_INDEX_SETUP' });
});

test('refuses a mixed production datastore that cannot enforce authentication indexes', async () => {
  const { models } = setup();
  models.AuthSession.getDatastore = () => ({ config: { adapter: 'sails-disk' } });
  await assert.rejects(ensureAuthIndexes({ models, production: true }), { code: 'E_AUTH_INDEX_SETUP' });
});

test('duplicate accounts or index permission failures stop startup without leaking database error details', async () => {
  for (const code of [11000, 13, 85]) {
    const databaseError = Object.assign(new Error('email=private@example.test mongodb://user:password@host/database'), { code });
    const { calls, models } = setup('sails-mongo', databaseError);
    await assert.rejects(ensureAuthIndexes({ models, production: true }), (error) => {
      assert.equal(error.code, 'E_AUTH_INDEX_SETUP');
      assert.match(error.message, /duplicate usernames or email/);
      assert.equal(error.message.includes('private@example.test'), false);
      assert.equal(error.message.includes('mongodb://'), false);
      assert.equal(error.cause, undefined);
      return true;
    });
    assert.equal(calls.length, 1);
  }
});
