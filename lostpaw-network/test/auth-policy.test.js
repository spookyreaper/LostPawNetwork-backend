const { afterEach, beforeEach, test, mock } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const authenticate = require('../api/policies/isAuthenticated');
const isLoggedIn = require('../api/policies/isLoggedIn');
const isUser = require('../api/policies/isUser');
const { passwordFingerprint, TOKEN_LIFETIME_SECONDS, ISSUER, AUDIENCE } = require('../lib/auth-tokens');

const USER_ID = 'a'.repeat(24);
const SESSION_ID = 'b'.repeat(64);
const SECRET = 'auth-policy-test-secret-with-32-characters';
const PASSWORD_HASH = bcrypt.hashSync('correct password', 4);
const ISSUED_AT = Math.floor(Date.now() / 1000);
let previousSecret;

function response() {
  return { statusCode: 200, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

function claims(overrides = {}) {
  return { userId: USER_ID, sub: USER_ID, jti: SESSION_ID, iss: ISSUER, aud: AUDIENCE, iat: ISSUED_AT, exp: ISSUED_AT + TOKEN_LIFETIME_SECONDS, ...overrides };
}

function signed(payload = claims(), options = {}) {
  return jwt.sign(Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined)), SECRET, { algorithm: 'HS256', ...options });
}

beforeEach(() => {
  previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = SECRET;
  global.User = { findOne: mock.fn(async () => ({ id: USER_ID, password: PASSWORD_HASH })) };
  global.AuthSession = { findOne: mock.fn(async () => ({ id: SESSION_ID, userId: USER_ID, expiresAt: (ISSUED_AT + TOKEN_LIFETIME_SECONDS) * 1000, passwordFingerprint: passwordFingerprint(PASSWORD_HASH) })) };
});

afterEach(() => {
  mock.restoreAll();
  delete global.User;
  delete global.AuthSession;
  if (previousSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = previousSecret;
});

test('legacy authentication has a distinct Sails policy identity and delegates token validation', async () => {
  assert.notEqual(isLoggedIn, authenticate);
  const req = { headers: { authorization: `Bearer ${signed()}` } };
  const next = mock.fn();
  await isLoggedIn(req, response(), next);
  assert.equal(next.mock.callCount(), 1);
  assert.deepEqual(req.user, { userId: USER_ID });
});

for (const authorization of [undefined, '', [], {}, 'Basic abc', 'Bearer', 'Bearer token extra', `Bearer ${'a'.repeat(4100)}`]) {
  test(`authentication rejects a malformed header: ${JSON.stringify(authorization)?.slice(0, 80)}`, async () => {
    const res = response();
    const next = mock.fn();
    await authenticate({ headers: { authorization } }, res, next);
    assert.equal(res.statusCode, 401);
    assert.equal(next.mock.callCount(), 0);
    assert.equal(User.findOne.mock.callCount(), 0);
    assert.equal(AuthSession.findOne.mock.callCount(), 0);
  });
}

test('authentication validates a live session and passes only its trusted identity downstream', async () => {
  const token = signed(claims({ admin: true, password: 'do-not-trust' }));
  const req = { headers: { authorization: `bearer   ${token}` } };
  const next = mock.fn();
  await authenticate(req, response(), next);
  assert.deepEqual(req.user, { userId: USER_ID });
  assert.deepEqual(req.auth, { sessionId: SESSION_ID, expiresAt: (ISSUED_AT + TOKEN_LIFETIME_SECONDS) * 1000 });
  assert.equal(next.mock.callCount(), 1);
  assert.deepEqual(User.findOne.mock.calls[0].arguments[0], { id: USER_ID });
  const criteria = AuthSession.findOne.mock.calls[0].arguments[0];
  assert.equal(criteria.id, SESSION_ID);
  assert.equal(criteria.userId, USER_ID);
  assert.equal(typeof criteria.expiresAt['>'], 'number');
});

for (const [name, token] of [
  ['expired', signed(claims({ exp: ISSUED_AT - 1 }))],
  ['wrong algorithm', signed(claims(), { algorithm: 'HS384' })],
  ['unsigned', jwt.sign(claims(), null, { algorithm: 'none' })],
  ['object userId', signed(claims({ userId: { $ne: null } }))],
  ['empty userId', signed(claims({ userId: ' ' }))],
  ['missing userId', signed(claims({ userId: undefined }))],
  ['missing expiry', signed(claims({ exp: undefined }))],
  ['missing issued-at', signed(claims(), { noTimestamp: true })],
  ['future issued-at', signed(claims({ iat: ISSUED_AT + 300, exp: ISSUED_AT + 3900 }))],
  ['excessive lifetime', signed(claims({ exp: ISSUED_AT + 86400 }))],
  ['missing session id', signed(claims({ jti: undefined }))],
  ['invalid session id', signed(claims({ jti: { $ne: null } }))],
  ['wrong issuer', signed(claims({ iss: 'another-service' }))],
  ['missing issuer', signed(claims({ iss: undefined }))],
  ['wrong audience', signed(claims({ aud: 'another-client' }))],
  ['missing audience', signed(claims({ aud: undefined }))],
  ['wrong subject', signed(claims({ sub: 'another-user' }))],
  ['missing subject', signed(claims({ sub: undefined }))],
  ['wrong token type', signed(claims(), { header: { typ: 'OTHER' } })],
  ['invalid signature', jwt.sign(claims(), 'a-different-test-secret')]
]) {
  test(`authentication rejects ${name} JWTs before querying users or sessions`, async () => {
    const res = response();
    const next = mock.fn();
    await authenticate({ headers: { authorization: `Bearer ${token}` } }, res, next);
    assert.equal(res.statusCode, 401);
    assert.equal(next.mock.callCount(), 0);
    assert.equal(User.findOne.mock.callCount(), 0);
    assert.equal(AuthSession.findOne.mock.callCount(), 0);
  });
}

for (const [name, session] of [
  ['revoked', null],
  ['deleted', { deleted: true }],
  ['expiry-mismatched', { expiresAt: ISSUED_AT * 1000 }],
]) {
  test(`a ${name} session cannot authenticate with its previously valid JWT`, async () => {
    AuthSession.findOne = mock.fn(async () => session);
    const res = response();
    const next = mock.fn();
    await authenticate({ headers: { authorization: `Bearer ${signed()}` } }, res, next);
    assert.equal(res.statusCode, 401);
    assert.equal(next.mock.callCount(), 0);
    assert.equal(User.findOne.mock.callCount(), 0);
  });
}

for (const [name, user] of [
  ['deleted', null],
  ['soft-deleted', { id: USER_ID, deleted: true, password: PASSWORD_HASH }],
  ['password-changed', { id: USER_ID, password: bcrypt.hashSync('changed password', 4) }],
]) {
  test(`a ${name} account cannot authenticate with its previously valid JWT`, async () => {
    User.findOne = mock.fn(async () => user);
    const res = response();
    const next = mock.fn();
    await authenticate({ headers: { authorization: `Bearer ${signed()}` } }, res, next);
    assert.equal(res.statusCode, 401);
    assert.equal(next.mock.callCount(), 0);
  });
}

for (const model of ['User', 'AuthSession']) {
  test(`${model} database failures return503 without exposing connection details`, async () => {
    global[model].findOne = mock.fn(async () => { throw new Error('secret-database-connection'); });
    const res = response();
    await authenticate({ headers: { authorization: `Bearer ${signed()}` } }, res, mock.fn());
    assert.equal(res.statusCode, 503);
    assert.doesNotMatch(JSON.stringify(res.body), /secret-database-connection/);
  });
}

for (const secret of [undefined, 'weak']) {
  test('missing or weak signing configuration returns503 without querying users', async () => {
    if (secret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = secret;
    const res = response();
    await authenticate({ headers: { authorization: `Bearer ${signed()}` } }, res, mock.fn());
    assert.equal(res.statusCode, 503);
    assert.equal(User.findOne.mock.callCount(), 0);
    assert.equal(AuthSession.findOne.mock.callCount(), 0);
  });
}

test('downstream failures are not mislabeled as invalid JWTs', async () => {
  const res = response();
  const error = new Error('downstream failure');
  await assert.rejects(authenticate({ headers: { authorization: `Bearer ${signed()}` } }, res, () => { throw error; }), error);
  assert.equal(res.statusCode, 200);
});

test('ownership uses verified JWT claims instead of obsolete cookie session state', () => {
  const legacy = response();
  isUser({ params: { id: USER_ID }, session: { userId: USER_ID } }, legacy, mock.fn());
  assert.equal(legacy.statusCode, 401);
  const forbidden = response();
  isUser({ params: { id: 'b'.repeat(24) }, user: { userId: USER_ID } }, forbidden, mock.fn());
  assert.equal(forbidden.statusCode, 403);
  const next = mock.fn();
  isUser({ params: { id: USER_ID }, user: { userId: USER_ID } }, response(), next);
  assert.equal(next.mock.callCount(), 1);
});
