const { createHmac } = require('node:crypto');
const { isIP } = require('node:net');

const MINUTE = 60 * 1000;
const limits = {
  login: { windowMs: 15 * MINUTE, ip: 30, account: 10 },
  register: { windowMs: 60 * MINUTE, ip: 10, account: 5 },
  sensitive: { windowMs: 15 * MINUTE, ip: 30, account: 10 },
  location: { windowMs: 15 * MINUTE, ip: 30, account: 15 },
};
let lastCleanupAt = 0;

// Group IPv6 addresses by /64, so rotating interface addresses cannot reset a limit.
function clientAddress(req) {
  const candidate = typeof req.ip === 'string' ? req.ip : req.socket?.remoteAddress;
  const ip = typeof candidate === 'string' ? candidate.split('%')[0] : '';
  if (isIP(ip) === 4) return ip;
  if (isIP(ip) !== 6) return 'unknown';
  let value = ip.toLowerCase();
  const dotted = /(?:^|:)(\d+\.\d+\.\d+\.\d+)$/.exec(value);
  if (dotted) {
    const bytes = dotted[1].split('.').map(Number);
    const tail = `${((bytes[0] << 8) | bytes[1]).toString(16)}:${((bytes[2] << 8) | bytes[3]).toString(16)}`;
    value = value.slice(0, -dotted[1].length) + tail;
  }
  const [head, tail] = value.split('::');
  const left = head ? head.split(':') : [];
  const right = tail ? tail.split(':') : [];
  const groups = tail === undefined ? left : [...left, ...Array(8 - left.length - right.length).fill('0'), ...right];
  const numbers = groups.map((group) => Number.parseInt(group, 16));
  if (numbers.slice(0, 5).every((group) => group === 0) && numbers[5] === 65535) {
    return `${numbers[6] >> 8}.${numbers[6] & 255}.${numbers[7] >> 8}.${numbers[7] & 255}`;
  }
  return `${numbers.slice(0, 4).map((group) => group.toString(16)).join(':')}::/64`;
}

function accountFor(req) {
  const email = req.body && typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  return email && email.length <= 254 ? email : null;
}

function rateLimited(retryAfter) {
  const error = new Error('Too many authentication attempts. Try again later.');
  error.status = 429;
  error.retryAfter = retryAfter;
  return error;
}

async function consume(model, bucket, maximum, expiresAt, now) {
  const occupied = await model.count({ bucket });
  if (!Number.isInteger(occupied) || occupied < 0) throw new Error('Invalid authentication counter.');
  if (occupied >= maximum) throw rateLimited(Math.max(1, Math.ceil((expiresAt - now) / 1000)));
  // Claim a bounded numbered slot through its unique primary key. Unlike a
  // read/update counter, duplicate-key enforcement stays atomic across workers
  // and adapters. In particular, sails-mongo's fetched updateOne preselects IDs.
  for (let slot = occupied + 1; slot <= maximum; slot += 1) {
    try {
      await model.create({ id: `${bucket}:${slot}`, bucket, expiresAt }).fetch();
      return;
    } catch (error) {
      if (error.code === 'E_UNIQUE' || error.code === 11000) continue;
      throw error;
    }
  }
  throw rateLimited(Math.max(1, Math.ceil((expiresAt - now) / 1000)));
}

async function throttleAuthentication(req, kind, model, now = Date.now()) {
  const config = limits[kind];
  if (!config) throw new Error('Unknown authentication route.');
  if (!model || !process.env.JWT_SECRET) throw new Error('Authentication limiter is unavailable.');
  const window = Math.floor(now / config.windowMs);
  const expiresAt = (window + 1) * config.windowMs;
  if (now - lastCleanupAt >= MINUTE) {
    // Do not retain IPs or email addresses. Expired counters are also periodically
    // deleted, so old windows cannot accumulate indefinitely in the datastore.
    await model.destroy({ expiresAt: { '<=': now } });
    lastCleanupAt = now;
  }
  const verifiedAccount = kind === 'sensitive' || kind === 'location';
  const account = verifiedAccount ? req.user?.userId : accountFor(req);
  if (verifiedAccount && (typeof account !== 'string' || !account)) throw new Error('Verified user required.');
  const buckets = [['ip', clientAddress(req)]];
  if (account) buckets.push(['account', account]);
  for (const [dimension, value] of buckets) {
    const digest = createHmac('sha256', process.env.JWT_SECRET).update(`${kind}:${dimension}:${value}`).digest('hex');
    await consume(model, `${kind}:${window}:${digest}`, config[dimension], expiresAt, now);
  }
}

function createAuthThrottlePolicy(kind) {
  return async function(req, res, next) {
    try {
      await throttleAuthentication(req, kind, sails.models.authattempt);
    } catch (error) {
      if (error.status === 429) {
        res.set('Retry-After', String(error.retryAfter));
        return res.status(429).json({ message: error.message });
      }
      return res.status(503).json({ message: 'Authentication is temporarily unavailable.' });
    }
    return next();
  };
}

module.exports = { throttleAuthentication, clientAddress, createAuthThrottlePolicy, consumeCounter: consume };
