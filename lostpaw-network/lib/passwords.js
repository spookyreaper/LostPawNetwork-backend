const bcrypt = require('bcrypt');
const { randomBytes } = require('node:crypto');

const BCRYPT_ROUNDS = 12;
const commonPasswords = new Set([
  'passwordpassword', 'password123456789', '123456789012345',
  '1234567890123456', 'qwertyuiopasdfgh', 'qwertyuiopasdfghjkl',
  'letmeinletmeinletmein', 'iloveyouiloveyou',
]);
let dummyHash;

function validatePassword(value, { isNew = false } = {}) {
  if (typeof value !== 'string' || !value.trim() || Buffer.byteLength(value, 'utf8') > 72) {
    return 'Password must contain between 1 and 72 bytes.';
  }
  if (isNew && (Array.from(value).length < 15 || /^(.)\1+$/u.test(value) || commonPasswords.has(value.toLowerCase()))) {
    return 'Choose a longer, less common password: at least 15 characters and at most 72 bytes.';
  }
  return null;
}

async function passwordMatches(password, hash) {
  // Unknown accounts still perform a password hash comparison.
  if (!dummyHash) dummyHash = bcrypt.hash(randomBytes(32).toString('hex'), BCRYPT_ROUNDS);
  const usable = typeof hash === 'string' && /^\$2[ab]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(hash);
  const matches = await bcrypt.compare(password, usable ? hash : await dummyHash);
  return usable && matches;
}

module.exports = { BCRYPT_ROUNDS, validatePassword, passwordMatches };
