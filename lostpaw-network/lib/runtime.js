const path = require('node:path');
const { randomBytes } = require('node:crypto');
const { isIP } = require('node:net');

const appPath = path.resolve(__dirname, '..');
const isProduction = (env) => env.NODE_ENV === 'production';

function getDatastoreConfig(env = process.env) {
  const adapter = env.DATASTORE_ADAPTER || (isProduction(env) ? 'mongo' : 'disk');
  if (adapter === 'disk') {
    if (isProduction(env)) throw new Error('The local disk database is for development only. Use MongoDB in production.');
    return { adapter: 'sails-disk', dir: path.resolve(appPath, env.LOCAL_DATA_DIR || '.data/database') };
  }
  if (adapter !== 'mongo') throw new Error('DATASTORE_ADAPTER must be disk or mongo.');
  if (!/^mongodb(?:\+srv)?:\/\//.test(env.MONGODB_URI || '')) {
    throw new Error('Set MONGODB_URI to a valid MongoDB connection URL.');
  }
  return { adapter: 'sails-mongo', url: env.MONGODB_URI };
}

function getAllowedOrigins(env = process.env) {
  if (isProduction(env) && !env.FRONTEND_ORIGINS?.trim()) {
    throw new Error('Set FRONTEND_ORIGINS to the exact HTTPS origins of the production frontend.');
  }
  const defaults = ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:4173', 'http://127.0.0.1:4173'];
  const origins = env.FRONTEND_ORIGINS ? env.FRONTEND_ORIGINS.split(',').map((value) => value.trim()).filter(Boolean) : defaults;
  if (!origins.length) throw new Error('FRONTEND_ORIGINS must contain at least one frontend origin.');
  for (const origin of origins) {
    let url;
    try { url = new URL(origin); } catch { throw new Error('FRONTEND_ORIGINS must contain complete http:// or https:// origins.'); }
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin) {
      throw new Error('FRONTEND_ORIGINS must contain origins without paths, credentials, or wildcards.');
    }
    if (isProduction(env) && url.protocol !== 'https:') {
      throw new Error('Production FRONTEND_ORIGINS must use HTTPS.');
    }
  }
  return [...new Set(origins)];
}

function getTrustedProxies(env = process.env) {
  if (env.TRUST_PROXY && env.TRUST_PROXY !== 'false') {
    throw new Error('Use TRUST_PROXY_IPS with explicit proxy IP addresses or CIDRs instead of TRUST_PROXY.');
  }
  if (!env.TRUST_PROXY_IPS?.trim()) return false;
  const proxies = env.TRUST_PROXY_IPS.split(',').map((value) => value.trim());
  for (const proxy of proxies) {
    const [address, prefix, extra] = proxy.split('/');
    const version = isIP(address);
    if (!version || extra !== undefined || (prefix !== undefined &&
      (!/^\d+$/.test(prefix) || Number(prefix) < 1 || Number(prefix) > (version === 4 ? 32 : 128)))) {
      throw new Error('TRUST_PROXY_IPS must contain explicit proxy IP addresses or non-universal CIDR ranges.');
    }
  }
  return [...new Set(proxies)];
}

function getPhotonSearchUrl(env = process.env) {
  let url;
  try { url = new URL(env.PHOTON_SEARCH_URL || 'https://photon.komoot.io/api/'); } catch {
    throw new Error('PHOTON_SEARCH_URL must be a complete HTTPS Photon API URL.');
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) {
    throw new Error('PHOTON_SEARCH_URL must be an HTTPS Photon API URL without credentials or a fragment.');
  }
  return url.href;
}

function initializeEnvironment(env = process.env) {
  getDatastoreConfig(env);
  getAllowedOrigins(env);
  getTrustedProxies(env);
  getPhotonSearchUrl(env);
  const port = env.PORT === undefined ? 1337 : Number(env.PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be a number between 1 and 65535.');
  if (!env.JWT_SECRET?.trim()) {
    if (isProduction(env)) throw new Error('Set a JWT_SECRET with at least 32 characters in production.');
    env.JWT_SECRET = randomBytes(48).toString('hex');
  }
  if (Buffer.byteLength(env.JWT_SECRET, 'utf8') < 32) throw new Error('JWT_SECRET must contain at least 32 bytes of random secret material.');
  if (isProduction(env) && (env.JWT_SECRET !== env.JWT_SECRET.trim() ||
    new Set(env.JWT_SECRET).size < 8 || /^(.{1,8})\1+$/.test(env.JWT_SECRET) ||
    /(?:secret|password|example|changeme|change[-_ ]?this|replace[-_ ]?me|your[-_ ]?key)/i.test(env.JWT_SECRET))) {
    throw new Error('JWT_SECRET must be cryptographically random; placeholders and repeated values are not allowed in production.');
  }
  return { port, host: env.HOST || (isProduction(env) ? '0.0.0.0' : '127.0.0.1') };
}

module.exports = { getDatastoreConfig, getAllowedOrigins, getTrustedProxies, getPhotonSearchUrl, initializeEnvironment };
