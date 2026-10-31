const { afterEach, beforeEach, test, mock } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcrypt');
const { createHash } = require('node:crypto');
const {
  issueToken, verifyToken, revokeSession, revokeUserSessions, passwordFingerprint,
  TOKEN_LIFETIME_SECONDS, ISSUER, AUDIENCE,
} = require('../lib/auth-tokens');
const sessionModel = require('../api/models/AuthSession');

const USER_ID = 'a'.repeat(24);
const PASSWORD_HASH = bcrypt.hashSync('correct password', 4);
let previousSecret;

beforeEach(() => {
  previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'token-test-secret-of-more-than-32-characters';
  global.AuthSession = {
    create: mock.fn(async () => {}),
    destroy: mock.fn(async () => []),
    destroyOne: mock.fn(async () => null),
  };
});

afterEach(() => {
  mock.restoreAll();
  delete global.AuthSession;
  if (previousSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = previousSecret;
});

test('issued JWTs have strict one-hour claims and a durable password-bound session without storing the token', async () => {
  const token = await issueToken(USER_ID, PASSWORD_HASH);
  const decoded = verifyToken(token);
  assert.equal(decoded.userId, USER_ID);
  assert.equal(decoded.sub, USER_ID);
  assert.equal(decoded.iss, ISSUER);
  assert.equal(decoded.aud, AUDIENCE);
  assert.equal(decoded.exp - decoded.iat, TOKEN_LIFETIME_SECONDS);
  assert.match(decoded.jti, /^[a-f0-9]{64}$/);
  const session = AuthSession.create.mock.calls[0].arguments[0];
  assert.deepEqual(session, { id: decoded.jti, userId: USER_ID, expiresAt: decoded.exp * 1000, passwordFingerprint: createHash('sha256').update(PASSWORD_HASH).digest('hex') });
  assert.equal(JSON.stringify(session).includes(token), false);
  assert.equal(JSON.stringify(session).includes(PASSWORD_HASH), false);
  assert.equal(AuthSession.destroy.mock.calls[0].arguments[0].expiresAt['<='] <= Date.now(), true);
});

test('independent logins use distinct unpredictable session identities', async () => {
  const first = verifyToken(await issueToken(USER_ID, PASSWORD_HASH));
  const second = verifyToken(await issueToken(USER_ID, PASSWORD_HASH));
  assert.notEqual(first.jti, second.jti);
});

test('session issuance fails closed when persistence is unavailable', async () => {
  AuthSession.create = mock.fn(async () => { throw new Error('store unavailable'); });
  await assert.rejects(issueToken(USER_ID, PASSWORD_HASH), /store unavailable/);
});

test('session cleanup failure does not issue an untracked token', async () => {
  AuthSession.destroy = mock.fn(async () => { throw new Error('store unavailable'); });
  await assert.rejects(issueToken(USER_ID, PASSWORD_HASH), /store unavailable/);
  assert.equal(AuthSession.create.mock.callCount(), 0);
});

test('weak or missing secrets cannot issue tokens or write sessions', async () => {
  for (const secret of ['', 'weak']) {
    process.env.JWT_SECRET = secret;
    await assert.rejects(issueToken(USER_ID, PASSWORD_HASH), { code: 'E_AUTH_CONFIGURATION' });
  }
  assert.equal(AuthSession.create.mock.callCount(), 0);
  assert.equal(AuthSession.destroy.mock.callCount(), 0);
});

test('invalid internal identity or unhashed passwords never reach session storage', async () => {
  for (const [id, hash] of [[{}, PASSWORD_HASH], [' ', PASSWORD_HASH], [USER_ID, 'plaintext'], [USER_ID, null]]) {
    await assert.rejects(issueToken(id, hash), { code: 'E_INVALID_AUTH_TOKEN' });
  }
  assert.equal(AuthSession.create.mock.callCount(), 0);
});

test('logout revokes only the verified session belonging to its authenticated owner', async () => {
  const sessionId = 'b'.repeat(64);
  await revokeSession(sessionId, USER_ID);
  assert.deepEqual(AuthSession.destroyOne.mock.calls[0].arguments[0], { id: sessionId, userId: USER_ID });
  await assert.rejects(revokeSession({ $ne: null }, USER_ID), { code: 'E_INVALID_AUTH_TOKEN' });
  assert.equal(AuthSession.destroyOne.mock.callCount(), 1);
});

test('password change revocation removes only that account’s sessions and propagates store failures', async () => {
  await revokeUserSessions(USER_ID);
  assert.deepEqual(AuthSession.destroy.mock.calls[0].arguments[0], { userId: USER_ID });
  AuthSession.destroyOne = mock.fn(async () => { throw new Error('store unavailable'); });
  await assert.rejects(revokeSession('b'.repeat(64), USER_ID), /store unavailable/);
});

test('fingerprints require a password hash and session serialization never exposes session identifiers', () => {
  assert.match(passwordFingerprint(PASSWORD_HASH), /^[a-f0-9]{64}$/);
  assert.equal(passwordFingerprint('plaintext'), null);
  assert.deepEqual(sessionModel.customToJSON.call({ id: 'secret-session', userId: USER_ID, expiresAt: 1 }), {});
});
