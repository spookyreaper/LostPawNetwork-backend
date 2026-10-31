const { createHash } = require('node:crypto');
const { consumeCounter } = require('./auth-throttle');
const { getPhotonSearchUrl } = require('./runtime');

const MAX_RESPONSE_BYTES = 256 * 1024;
const CACHE_TTL_MS = 15 * 60 * 1000;
const USER_AGENT = 'LostPawNetwork/1.0 (+https://github.com/spookyreaper/LostPawNetwork-backend)';

function searchError(status, message, retryAfter) {
  return Object.assign(new Error(message), { status, retryAfter });
}

function queryFor(value) {
  if (typeof value !== 'string') throw searchError(400, 'Enter an address or place name.');
  const query = value.trim().replace(/\s+/g, ' ');
  if (query.length < 3 || query.length > 200 || /\p{Cc}/u.test(query)) {
    throw searchError(400, 'Enter an address or place name between 3 and 200 characters.');
  }
  return query;
}

function normalizeResults(data) {
  if (!data || data.type !== 'FeatureCollection' || !Array.isArray(data.features)) throw new Error('Invalid provider response.');
  const results = [];
  const seen = new Set();
  for (const feature of data.features.slice(0, 40)) {
    const coordinates = feature?.geometry?.coordinates;
    if (feature?.geometry?.type !== 'Point' || !Array.isArray(coordinates)) continue;
    const [lng, lat] = coordinates;
    if (![lat, lng].every(Number.isFinite) || Math.abs(lat) > 90 || Math.abs(lng) > 180) continue;
    const properties = feature.properties;
    if (!properties || typeof properties !== 'object' || Array.isArray(properties)) continue;
    const text = (value) => typeof value === 'string' ? value.replace(/\p{Cc}/gu, '').trim().slice(0, 150) : '';
    const street = [text(properties.housenumber), text(properties.street)].filter(Boolean).join(' ');
    const parts = [properties.name, street, properties.city || properties.town || properties.village || properties.district, properties.state, properties.postcode, properties.country].map(text).filter(Boolean);
    const label = [...new Map(parts.map((part) => [part.toLowerCase(), part])).values()].join(', ').slice(0, 300);
    if (!label) continue;
    const key = `${lat}:${lng}:${label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    results.push({ id: createHash('sha256').update(key).digest('hex').slice(0, 24), label, lat, lng });
    if (results.length === 5) break;
  }
  return results;
}

async function boundedJson(response) {
  if (!response.ok || !/\bapplication\/(?:[a-z0-9.+-]*\+)?json\b/i.test(response.headers.get('content-type') || '')) {
    await response.body?.cancel();
    throw new Error('Provider unavailable.');
  }
  if (Number(response.headers.get('content-length')) > MAX_RESPONSE_BYTES) {
    await response.body?.cancel();
    throw new Error('Provider response too large.');
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error('Missing provider response.');
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        throw new Error('Provider response too large.');
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function createLocationSearch({ fetcher = (...args) => fetch(...args), now = Date.now, wait = (delay) => new Promise((resolve) => setTimeout(resolve, delay)), minIntervalMs = 1000, timeoutMs = 5000 } = {}) {
  const cache = new Map();
  const pending = new Map();
  let nextStart = 0;
  let startQueue = Promise.resolve();

  return async function searchPlaces(value, model) {
    const query = queryFor(value);
    const endpoint = getPhotonSearchUrl();
    const key = createHash('sha256').update(`${endpoint}:${query.toLowerCase()}`).digest('hex');
    const cached = cache.get(key);
    if (cached?.expiresAt > now()) return cached.results;
    cache.delete(key);
    if (pending.has(key)) return pending.get(key);
    if (pending.size >= 5) throw searchError(429, 'Location search is busy. Please try again in a moment.', 1);

    const search = (async () => {
      if (!model) throw new Error('Search limiter unavailable.');
      const startedAt = now();
      const minute = Math.floor(startedAt / 60000);
      const provider = createHash('sha256').update(endpoint).digest('hex');
      // A shared budget keeps total public-provider traffic moderate across API
      // workers. Only uncached lookups consume the provider's 30/minute budget.
      await consumeCounter(model, `location-provider:${minute}:${provider}`, 30, (minute + 1) * 60000, startedAt);
      const start = startQueue.catch(() => {}).then(async () => {
        const delay = Math.max(0, nextStart - now());
        if (delay) await wait(delay);
        nextStart = now() + minIntervalMs;
      });
      startQueue = start;
      await start;

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const url = new URL(endpoint);
        url.searchParams.set('q', query);
        url.searchParams.set('limit', '5');
        url.searchParams.set('lang', 'en');
        const response = await fetcher(url, {
          headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
          redirect: 'error',
          signal: controller.signal,
        });
        const results = normalizeResults(await boundedJson(response));
        for (const [oldKey, entry] of cache) if (entry.expiresAt <= now()) cache.delete(oldKey);
        if (cache.size >= 200) cache.delete(cache.keys().next().value);
        cache.set(key, { results, expiresAt: now() + CACHE_TTL_MS });
        return results;
      } finally {
        clearTimeout(timer);
      }
    })();
    pending.set(key, search);
    try {
      return await search;
    } finally {
      pending.delete(key);
    }
  };
}

module.exports = { queryFor, normalizeResults, createLocationSearch, searchPlaces: createLocationSearch() };
