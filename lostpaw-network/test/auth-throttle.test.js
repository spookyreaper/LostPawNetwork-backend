const { test, beforeEach, afterEach, mock } = require('node:test');
const assert = require('node:assert/strict');
const { throttleAuthentication, clientAddress } = require('../lib/auth-throttle');
const loginThrottle = require('../api/policies/loginThrottle');
const registerThrottle = require('../api/policies/registerThrottle');
const sensitiveAuthThrottle = require('../api/policies/sensitiveAuthThrottle');
const { policies } = require('../config/policies');

const NOW = 1_800_000_000_000;
let previousSecret;

function counterModel(records = new Map()) {
  return {
    records,
    async count({ bucket }) { return [...records.values()].filter((record) => record.bucket === bucket).length; },
    create(values) {
      return { async fetch() {
        if (records.has(values.id)) throw Object.assign(new Error('Duplicate counter.'), { code: 'E_UNIQUE' });
        records.set(values.id, { ...values });
        return { ...values };
      } };
    },
    async destroy({ expiresAt }) {
      for (const [id, record] of records) if (record.expiresAt <= expiresAt['<=']) records.delete(id);
    },
  };
}

function response() {
  return {
    statusCode: 200,
    headers: {},
    set(name, value) { this.headers[name] = value; return this; },
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

beforeEach(() => {
  previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'auth-throttle-test-secret-not-for-production';
});
afterEach(() => {
  mock.restoreAll();
  delete global.sails;
  if (previousSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = previousSecret;
});

test('policies throttle login, registration, and password reauthentication before controllers run', () => {
  assert.equal(policies.UserController.login, 'loginThrottle');
  assert.equal(policies.UserController.register, 'registerThrottle');
  assert.deepEqual(policies.UserController.changePassword, ['isAuthenticated', 'sensitiveAuthThrottle']);
  for (const action of ['update', 'destroy']) {
    assert.deepEqual(policies.UserController[action], ['isAuthenticated', 'sensitiveAuthThrottle', 'isUser']);
  }
});

test('email normalization shares one login budget across IP addresses and never stores identifiers', async () => {
  const model = counterModel();
  for (let attempt = 0; attempt < 10; attempt += 1) {
    await throttleAuthentication({ ip: `192.0.2.${attempt}`, body: { email: attempt % 2 ? ' Person@Example.Test ' : 'person@example.test' } }, 'login', model, NOW);
  }
  await assert.rejects(throttleAuthentication({ ip: '198.51.100.1', body: { email: 'person@example.test' } }, 'login', model, NOW), (error) => error.status === 429 && error.retryAfter === 900);
  assert.doesNotMatch(JSON.stringify([...model.records]), /person@example|192\.0\.2|198\.51\.100/);
});

test('IP budget prevents spraying many accounts and ignores forged forwarding headers', async () => {
  const model = counterModel();
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await throttleAuthentication({ ip: '192.0.2.1', headers: { 'x-forwarded-for': `198.51.100.${attempt}` }, body: { email: `person${attempt}@example.test` } }, 'login', model, NOW);
  }
  await assert.rejects(throttleAuthentication({ ip: '192.0.2.1', headers: { 'x-forwarded-for': '203.0.113.5' }, body: { email: 'another@example.test' } }, 'login', model, NOW), (error) => error.status === 429);
});

test('IPv4-mapped IPv6 and /64 IPv6 rotations cannot create fresh IP budgets', () => {
  assert.equal(clientAddress({ ip: '::ffff:192.0.2.1' }), '192.0.2.1');
  assert.equal(clientAddress({ ip: '::ffff:c000:201' }), '192.0.2.1');
  assert.equal(clientAddress({ ip: '2001:db8:1234:5678:1111:2222:3333:4444' }), clientAddress({ ip: '2001:0db8:1234:5678::1' }));
  assert.equal(clientAddress({ ip: 'fe80::1%en0' }), 'fe80:0:0:0::/64');
  assert.equal(clientAddress({ socket: { remoteAddress: '192.0.2.2' }, headers: { 'x-forwarded-for': '203.0.113.1' } }), '192.0.2.2');
  assert.equal(clientAddress({ headers: { 'x-forwarded-for': '203.0.113.1' } }), 'unknown');
});

test('concurrent attempts and separate limiter instances cannot exceed a shared persistent account budget', async () => {
  const records = new Map();
  const firstWorker = counterModel(records);
  const secondWorker = counterModel(records);
  const results = await Promise.allSettled(Array.from({ length: 40 }, (unused, index) => throttleAuthentication({ ip: `192.0.2.${index}`, body: { email: 'target@example.test' } }, 'login', index % 2 ? firstWorker : secondWorker, NOW)));
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 10);
  assert.equal(results.filter((result) => result.status === 'rejected' && result.reason.status === 429).length, 30);
  const restartedWorker = counterModel(records);
  await assert.rejects(throttleAuthentication({ ip: '203.0.113.1', body: { email: 'target@example.test' } }, 'login', restartedWorker, NOW), (error) => error.status === 429);
});

test('registration uses a separate stricter budget and expired counters are removed', async () => {
  const model = counterModel();
  const req = { ip: '192.0.2.1', body: { email: 'person@example.test' } };
  for (let attempt = 0; attempt < 5; attempt += 1) await throttleAuthentication(req, 'register', model, NOW);
  await assert.rejects(throttleAuthentication(req, 'register', model, NOW), (error) => error.status === 429 && error.retryAfter === 3600);
  await throttleAuthentication(req, 'login', model, NOW);
  await throttleAuthentication(req, 'register', model, NOW + 3_600_000);
  assert.equal(model.records.size, 2);
  for (const counter of model.records.values()) assert.ok(counter.expiresAt > NOW + 3_600_000);
});

test('sensitive actions share the verified user budget even when supplied email or client IP changes', async () => {
  const model = counterModel();
  for (let attempt = 0; attempt < 10; attempt += 1) {
    await throttleAuthentication({ ip: `192.0.2.${attempt}`, user: { userId: 'verified-user' }, body: { email: `different${attempt}@example.test` } }, 'sensitive', model, NOW);
  }
  await assert.rejects(throttleAuthentication({ ip: '198.51.100.1', user: { userId: 'verified-user' } }, 'sensitive', model, NOW), (error) => error.status === 429);
  await throttleAuthentication({ ip: '198.51.100.1', user: { userId: 'another-user' } }, 'sensitive', model, NOW);
  await assert.rejects(throttleAuthentication({ ip: '198.51.100.1', body: { userId: 'another-user' } }, 'sensitive', model, NOW), /Verified user/);
});

for (const [kind, policy] of [['login', loginThrottle], ['register', registerThrottle], ['sensitive', sensitiveAuthThrottle]]) {
  test(`${kind} policy rejects blocked attempts with Retry-After and a generic response`, async () => {
    global.sails = { models: { authattempt: counterModel() } };
    const req = { ip: '192.0.2.1', user: { userId: 'verified-user' }, body: { email: 'person@example.test' } };
    const count = kind === 'register' ? 5 : 10;
    for (let attempt = 0; attempt < count; attempt += 1) await policy(req, response(), mock.fn());
    const next = mock.fn();
    const res = response();
    await policy(req, res, next);
    assert.equal(res.statusCode, 429);
    assert.ok(Number(res.headers['Retry-After']) >= 1);
    assert.equal(next.mock.callCount(), 0);
    assert.equal(res.body.message, 'Too many authentication attempts. Try again later.');
    assert.doesNotMatch(JSON.stringify(res.body), /person@example|verified-user|192\.0\.2/);
  });
}

test('limiter datastore failures fail closed without exposing internal errors or consuming bcrypt work', async () => {
  global.sails = { models: { authattempt: { count: async () => { throw new Error('private-mongo-connection'); }, destroy: async () => {} } } };
  const res = response();
  const next = mock.fn();
  await loginThrottle({ ip: '192.0.2.1', body: { email: 'person@example.test' } }, res, next);
  assert.equal(res.statusCode, 503);
  assert.equal(next.mock.callCount(), 0);
  assert.doesNotMatch(JSON.stringify(res.body), /private-mongo-connection/);
});

test('downstream errors are not swallowed as authentication limiter failures', async () => {
  global.sails = { models: { authattempt: counterModel() } };
  const error = new Error('downstream failure');
  await assert.rejects(loginThrottle({ ip: '192.0.2.1', body: { email: 'person@example.test' } }, response(), () => { throw error; }), error);
});
