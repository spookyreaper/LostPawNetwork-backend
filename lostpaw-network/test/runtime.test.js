const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { getDatastoreConfig, getAllowedOrigins, getTrustedProxies, initializeEnvironment } = require('../lib/runtime');
const production = {
  NODE_ENV: 'production', MONGODB_URI: 'mongodb://localhost/db',
  FRONTEND_ORIGINS: 'https://pets.example.test',
};
const strongSecret = 'f9b7f0a24bd6c18e41297f3058d4ea61c53bf948e7a20d645c10679b83e5a092';

test('development runs locally even when an old MongoDB URL is present', () => {
  const env = { NODE_ENV: 'development', MONGODB_URI: 'mongodb+srv://unavailable.example.test/db' };
  const config = getDatastoreConfig(env);
  assert.equal(config.adapter, 'sails-disk');
  assert.equal(config.dir, path.resolve(__dirname, '../.data/database'));
  const runtime = initializeEnvironment(env);
  assert.equal(runtime.host, '127.0.0.1');
  assert.equal(runtime.port, 1337);
  assert.ok(env.JWT_SECRET.length >= 32);
  const secret = env.JWT_SECRET;
  initializeEnvironment(env);
  assert.equal(env.JWT_SECRET, secret);
});

test('production requires a working MongoDB configuration and a strong JWT secret', () => {
  assert.throws(() => initializeEnvironment({ NODE_ENV: 'production' }), /MONGODB_URI/);
  assert.throws(() => initializeEnvironment({ NODE_ENV: 'production', DATASTORE_ADAPTER: 'disk' }), /development only/);
  assert.throws(() => initializeEnvironment(production), /JWT_SECRET/);
  assert.throws(() => initializeEnvironment({ ...production, JWT_SECRET: 'short' }), /32 bytes/);
  assert.throws(() => initializeEnvironment({ ...production, JWT_SECRET: 'x'.repeat(64) }), /random/);
  assert.throws(() => initializeEnvironment({ ...production, JWT_SECRET: '12345678'.repeat(8) }), /random/);
  assert.throws(() => initializeEnvironment({ ...production, JWT_SECRET: 'replace-me-with-a-secret-value-with-at-least-32-characters' }), /random/);
  assert.equal(initializeEnvironment({ ...production, JWT_SECRET: strongSecret }).host, '0.0.0.0');
  assert.throws(() => initializeEnvironment({ JWT_SECRET: 'short' }), /32 bytes/);
});

test('explicit local and Mongo adapters are validated rather than silently falling back', () => {
  assert.equal(getDatastoreConfig({ DATASTORE_ADAPTER: 'mongo', MONGODB_URI: 'mongodb://localhost/db' }).adapter, 'sails-mongo');
  assert.throws(() => getDatastoreConfig({ DATASTORE_ADAPTER: 'unknown' }), /disk or mongo/);
  assert.throws(() => getDatastoreConfig({ DATASTORE_ADAPTER: 'mongo', MONGODB_URI: '' }), /MONGODB_URI/);
  assert.throws(() => initializeEnvironment({ PORT: 'not-a-port' }), /PORT/);
  assert.throws(() => initializeEnvironment({ PORT: '65536' }), /PORT/);
});

test('CORS allows the local frontend and rejects wildcards or malformed origins', () => {
  assert.ok(getAllowedOrigins({}).includes('http://127.0.0.1:5173'));
  assert.deepEqual(getAllowedOrigins({ FRONTEND_ORIGINS: 'https://pets.example.test, https://pets.example.test' }), ['https://pets.example.test']);
  for (const origin of ['*', 'https://pets.example.test/path', 'file://example.test', 'https://user:pass@pets.example.test']) {
    assert.throws(() => getAllowedOrigins({ FRONTEND_ORIGINS: origin }), /origins/);
  }
  assert.throws(() => getAllowedOrigins({ NODE_ENV: 'production' }), /FRONTEND_ORIGINS/);
  assert.throws(() => getAllowedOrigins({ NODE_ENV: 'production', FRONTEND_ORIGINS: 'http://pets.example.test' }), /HTTPS/);
  assert.deepEqual(getAllowedOrigins(production), ['https://pets.example.test']);
});

test('proxy trust requires explicit addresses and rejects universal or malformed ranges', () => {
  assert.equal(getTrustedProxies({}), false);
  assert.equal(getTrustedProxies({ TRUST_PROXY: 'false' }), false);
  assert.deepEqual(getTrustedProxies({ TRUST_PROXY_IPS: '127.0.0.1, ::1, 10.1.2.0/24, 127.0.0.1' }), ['127.0.0.1', '::1', '10.1.2.0/24']);
  for (const invalid of ['*', '0.0.0.0/0', '::/0', '127.0.0.1/33', '::1/129', '127.0.0.1/-1', 'loopback', 'localhost', '127.0.0.1,', '10.1.2.0/24/8']) {
    assert.throws(() => getTrustedProxies({ TRUST_PROXY_IPS: invalid }), /TRUST_PROXY_IPS/);
  }
  assert.throws(() => getTrustedProxies({ TRUST_PROXY: 'true' }), /TRUST_PROXY_IPS/);
});
