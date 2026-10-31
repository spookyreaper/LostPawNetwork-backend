const { randomBytes, createHash } = require('node:crypto');
const jwt = require('jsonwebtoken');

const TOKEN_LIFETIME_SECONDS = 60 * 60;
const MAX_TOKEN_LENGTH = 4096;
const ISSUER = 'lostpaw-network';
const AUDIENCE = 'lostpaw-network-api';
const sessionIdPattern = /^[a-f0-9]{64}$/;

function invalidToken() {
  const error = new Error('Invalid or expired token.');
  error.code = 'E_INVALID_AUTH_TOKEN';
  return error;
}

function signingSecret() {
  const secret = process.env.JWT_SECRET;
  if (typeof secret !== 'string' || Buffer.byteLength(secret, 'utf8') < 32) {
    const error = new Error('Authentication is temporarily unavailable.');
    error.code = 'E_AUTH_CONFIGURATION';
    throw error;
  }
  return secret;
}

function validUserId(value) {
  return typeof value === 'string' && value.length > 0 && value.length <= 150 && value === value.trim();
}

function passwordFingerprint(passwordHash) {
  if (typeof passwordHash !== 'string' || !/^\$2[aby]\$\d\d\$[./A-Za-z0-9]{53}$/.test(passwordHash)) return null;
  return createHash('sha256').update(passwordHash).digest('hex');
}

async function issueToken(userId, passwordHash) {
  if (!validUserId(userId)) throw invalidToken();
  const fingerprint = passwordFingerprint(passwordHash);
  if (!fingerprint) throw invalidToken();
  const now = Date.now();
  const issuedAt = Math.floor(now / 1000);
  const sessionId = randomBytes(32).toString('hex');
  const token = jwt.sign({ userId, iat: issuedAt }, signingSecret(), {
    algorithm: 'HS256',
    issuer: ISSUER,
    audience: AUDIENCE,
    subject: userId,
    jwtid: sessionId,
    expiresIn: TOKEN_LIFETIME_SECONDS,
  });

  // Durable records let logout revoke tokens across restarts and API workers.
  // Keep expired sessions from accumulating even on the development disk store.
  await AuthSession.destroy({ expiresAt: { '<=': now } });
  await AuthSession.create({
    id: sessionId,
    userId,
    passwordFingerprint: fingerprint,
    expiresAt: (issuedAt + TOKEN_LIFETIME_SECONDS) * 1000,
  });
  return token;
}

function verifyToken(token) {
  const secret = signingSecret();
  if (typeof token !== 'string' || token.length > MAX_TOKEN_LENGTH) throw invalidToken();
  let verified;
  try {
    verified = jwt.verify(token, secret, {
      algorithms: ['HS256'],
      issuer: ISSUER,
      audience: AUDIENCE,
      complete: true,
      maxAge: TOKEN_LIFETIME_SECONDS,
    });
  } catch {
    throw invalidToken();
  }
  const { payload, header } = verified;
  const now = Math.floor(Date.now() / 1000);
  if (!payload || typeof payload !== 'object' || header.typ !== 'JWT'
    || !validUserId(payload.userId) || payload.sub !== payload.userId
    || typeof payload.jti !== 'string' || !sessionIdPattern.test(payload.jti)
    || !Number.isInteger(payload.iat) || !Number.isInteger(payload.exp)
    || payload.iat > now + 30 || payload.exp <= now
    || payload.exp <= payload.iat || payload.exp - payload.iat > TOKEN_LIFETIME_SECONDS) {
    throw invalidToken();
  }
  return payload;
}

async function revokeSession(sessionId, userId) {
  if (typeof sessionId !== 'string' || !sessionIdPattern.test(sessionId) || !validUserId(userId)) throw invalidToken();
  await AuthSession.destroyOne({ id: sessionId, userId });
}

async function revokeUserSessions(userId) {
  if (!validUserId(userId)) throw invalidToken();
  await AuthSession.destroy({ userId });
}

module.exports = { issueToken, verifyToken, revokeSession, revokeUserSessions, passwordFingerprint, TOKEN_LIFETIME_SECONDS, MAX_TOKEN_LENGTH, ISSUER, AUDIENCE };
