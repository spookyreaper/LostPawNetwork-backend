const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const net = require('node:net');
const { Sails } = require('sails');

let app;
let base;

async function post(route, body, forwardedFor) {
  const response = await fetch(`${base}${route}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': forwardedFor },
    body: JSON.stringify(body),
  });
  return { status: response.status, data: await response.json(), headers: response.headers };
}

before(async () => {
  process.env.NODE_ENV = 'test';
  process.env.DATASTORE_ADAPTER = 'disk';
  process.env.JWT_SECRET = 'http-limiter-test-secret-not-for-production-use';
  const probe = net.createServer();
  await new Promise((resolve) => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  app = new Sails();
  await new Promise((resolve, reject) => app.lift({
    appPath: path.resolve(__dirname, '..'), environment: 'test', port, explicitHost: '127.0.0.1',
    hooks: { grunt: false, sockets: false, session: false, views: false },
    datastores: { default: { adapter: 'sails-disk', inMemoryOnly: true } },
    http: { trustProxy: false },
    log: { level: 'silent' },
  }, (error) => error ? reject(error) : resolve()));
  base = `http://127.0.0.1:${app.hooks.http.server.address().port}`;
});

after(async () => {
  if (app) await new Promise((resolve) => app.lower(resolve));
});

test('real parallel login requests share one durable account budget and cannot bypass it with forwarded headers', async () => {
  const attempts = await Promise.all(Array.from({ length: 20 }, (unused, index) => post('/user/login', { email: index % 2 ? ' NO-SUCH-USER@example.test ' : 'no-such-user@example.test', password: 'a-wrong-password-for-testing' }, `192.0.2.${index}`)));
  assert.equal(attempts.filter((attempt) => attempt.status === 401).length, 10);
  assert.equal(attempts.filter((attempt) => attempt.status === 429).length, 10);
  for (const attempt of attempts.filter((value) => value.status === 429)) {
    assert.ok(Number(attempt.headers.get('retry-after')) >= 1);
    assert.equal(attempt.data.message, 'Too many authentication attempts. Try again later.');
  }
  const spoofed = await post('/user/login', { email: 'no-such-user@example.test', password: 'a-wrong-password-for-testing' }, '203.0.113.99');
  assert.equal(spoofed.status, 429);
  // The exact count also proves duplicate-key races never overfill an account
  // bucket: twenty-one IP slots and only ten account slots were consumed.
  assert.equal(await app.models.authattempt.count(), 31);
});

test('registration has its own IP budget and rejected weak passwords still consume an attempt', async () => {
  for (let index = 0; index < 10; index += 1) {
    const attempt = await post('/user/register', { username: `Throttled ${index}`, email: `throttled${index}@example.test`, password: 'short' }, `198.51.100.${index}`);
    assert.equal(attempt.status, 400);
  }
  const blocked = await post('/user/register', { username: 'Another', email: 'another@example.test', password: 'a-longer-registration-password' }, '203.0.113.9');
  assert.equal(blocked.status, 429);
  assert.ok(Number(blocked.headers.get('retry-after')) >= 1);
  assert.equal(await app.models.user.count(), 0);
});

test('real limiter datastore failures fail closed without disclosing database details', async () => {
  const model = app.models.authattempt;
  const original = model.count;
  model.count = async () => { throw new Error('private-auth-database-password'); };
  try {
    const unavailable = await post('/user/login', { email: 'different@example.test', password: 'a-wrong-password-for-testing' }, '203.0.113.9');
    assert.equal(unavailable.status, 503);
    assert.equal(unavailable.data.message, 'Authentication is temporarily unavailable.');
    assert.doesNotMatch(JSON.stringify(unavailable.data), /private-auth-database-password/);
  } finally {
    model.count = original;
  }
});
