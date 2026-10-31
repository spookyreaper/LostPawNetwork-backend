const { before, after, beforeEach, afterEach, test, mock } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const net = require('node:net');
const bcrypt = require('bcrypt');
const { Sails } = require('sails');
const { generateId } = require('../lib/id');
const { issueToken } = require('../lib/auth-tokens');

const nativeFetch = global.fetch;
const featureCollection = {
  type: 'FeatureCollection',
  features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [-73.9654, 40.7829] }, properties: { name: 'Central Park', city: 'New York', country: 'United States', private: 'not-for-the-browser' } }],
};
let app;
let base;
let token;
let providerFetch;
let providerResponse;

async function request({ body, headers = {}, authorization = token, contentType = 'application/json' } = {}) {
  const response = await nativeFetch(`${base}/locations/search`, {
    method: 'POST',
    headers: { ...(authorization ? { Authorization: `Bearer ${authorization}` } : {}), 'Content-Type': contentType, ...headers },
    body: contentType === 'application/json' ? JSON.stringify(body) : body,
  });
  return { status: response.status, headers: response.headers, body: await response.json() };
}

before(async () => {
  process.env.NODE_ENV = 'test';
  process.env.DATASTORE_ADAPTER = 'disk';
  process.env.JWT_SECRET = 'location-http-test-signing-key-not-for-production';
  process.env.PHOTON_SEARCH_URL = 'https://photon.komoot.io/api/';
  const probe = net.createServer();
  await new Promise((resolve) => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  app = new Sails();
  await new Promise((resolve, reject) => app.lift({
    appPath: path.resolve(__dirname, '..'), environment: 'test', port, explicitHost: '127.0.0.1',
    hooks: { grunt: false, sockets: false, session: false, views: false },
    datastores: { default: { adapter: 'sails-disk', inMemoryOnly: true } },
    http: { trustProxy: false }, log: { level: 'silent' },
  }, (error) => error ? reject(error) : resolve()));
  base = `http://127.0.0.1:${app.hooks.http.server.address().port}`;
  const user = await app.models.user.create({ id: generateId(), username: 'Place search tester', email: 'place-search@example.test', password: await bcrypt.hash('legacy-test-password', 4) }).fetch();
  token = await issueToken(user.id, user.password);
});

beforeEach(async () => {
  await app.models.authattempt.destroy({});
  providerResponse = () => new Response(JSON.stringify(featureCollection), { headers: { 'Content-Type': 'application/json' } });
  providerFetch = mock.method(global, 'fetch', async (url, options) => {
    assert.equal(new URL(url).origin, 'https://photon.komoot.io');
    return providerResponse(url, options);
  });
});

afterEach(() => mock.restoreAll());
after(async () => { if (app) await new Promise((resolve) => app.lower(resolve)); });

test('place search requires a live authenticated session and JSON before any external request', async () => {
  const unauthorized = await request({ authorization: null, body: { query: 'Central Park' } });
  assert.equal(unauthorized.status, 401);
  const notJson = await request({ contentType: 'text/plain', body: 'private query' });
  assert.equal(notJson.status, 415);
  assert.equal(providerFetch.mock.callCount(), 0);
});

test('invalid location queries never reach the provider', async () => {
  for (const body of [{}, [], { query: {} }, { query: 'ab' }, { query: 'x'.repeat(201) }]) {
    const result = await request({ body });
    assert.equal(result.status, 400);
    assert.equal(result.body.results, undefined);
  }
  assert.equal(providerFetch.mock.callCount(), 0);
});

test('real HTTP search returns only named coordinates, caches repeat requests, and keeps credentials server-side', async () => {
  const query = 'Central Park, New York HTTP search';
  const first = await request({ body: { query, providerUrl: 'http://attacker.example.test' }, headers: { Cookie: 'private-cookie', 'X-Forwarded-For': '203.0.113.8' } });
  assert.equal(first.status, 200);
  assert.deepEqual(first.body.results.map(({ label, lat, lng }) => ({ label, lat, lng })), [{ label: 'Central Park, New York, United States', lat: 40.7829, lng: -73.9654 }]);
  assert.match(first.body.results[0].id, /^[a-f0-9]{24}$/);
  assert.doesNotMatch(JSON.stringify(first.body), /not-for-the-browser|private-cookie|providerUrl/);
  const repeated = await request({ body: { query: query.toUpperCase() } });
  assert.equal(repeated.status, 200);
  assert.deepEqual(repeated.body, first.body);
  assert.equal(providerFetch.mock.callCount(), 1);
  const [url, options] = providerFetch.mock.calls[0].arguments;
  assert.equal(url.searchParams.get('q'), query);
  assert.equal(options.headers.Authorization, undefined);
  assert.equal(options.headers.Cookie, undefined);
  assert.equal(options.redirect, 'error');
  assert.match(options.headers['User-Agent'], /LostPawNetwork/);
  assert.equal(first.headers.get('cache-control'), 'no-store');
});

test('no matching places returns an empty list while provider failures return a safe retryable error', async () => {
  providerResponse = () => new Response('{"type":"FeatureCollection","features":[]}', { headers: { 'Content-Type': 'application/json' } });
  const empty = await request({ body: { query: 'No matching HTTP place' } });
  assert.equal(empty.status, 200);
  assert.deepEqual(empty.body, { results: [] });
  providerResponse = () => new Response('private-provider-credentials', { status: 503 });
  const unavailable = await request({ body: { query: 'Provider failed HTTP place' } });
  assert.equal(unavailable.status, 503);
  assert.equal(unavailable.body.message, 'Location search is unavailable. You can still choose a point on the map.');
  assert.doesNotMatch(JSON.stringify(unavailable.body), /private-provider-credentials/);
});

test('location search has a separate persisted verified-user budget and forged forwarding headers cannot reset it', async () => {
  for (let index = 0; index < 15; index += 1) {
    const response = await request({ body: { query: 'Repeated HTTP budget place' }, headers: { 'X-Forwarded-For': `203.0.113.${index}` } });
    assert.equal(response.status, 200);
  }
  const blocked = await request({ body: { query: 'A new blocked place' }, headers: { 'X-Forwarded-For': '198.51.100.1' } });
  assert.equal(blocked.status, 429);
  assert.ok(Number(blocked.headers.get('retry-after')) >= 1);
  assert.equal(providerFetch.mock.callCount(), 1);
});

test('search limiter storage errors fail closed without exposing private data', async () => {
  const model = app.models.authattempt;
  const original = model.count;
  model.count = async () => { throw new Error('private-search-database-password'); };
  try {
    const response = await request({ body: { query: 'Storage failed HTTP place' } });
    assert.equal(response.status, 503);
    assert.doesNotMatch(JSON.stringify(response.body), /private-search-database-password/);
    assert.equal(providerFetch.mock.callCount(), 0);
  } finally {
    model.count = original;
  }
});
