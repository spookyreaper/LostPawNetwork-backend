const { test, mock } = require('node:test');
const assert = require('node:assert/strict');
const { queryFor, normalizeResults, createLocationSearch } = require('../lib/location-search');
const { getPhotonSearchUrl } = require('../lib/runtime');

const NOW = 1_800_000_000_000;
const fixture = {
  type: 'FeatureCollection',
  features: [{ type: 'Feature', geometry: { type: 'Point', coordinates: [-73.9654, 40.7829] }, properties: { name: 'Central Park', city: 'New York', state: 'New York', country: 'United States' } }],
};
const response = (value = fixture, options = {}) => new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' }, ...options });

function counterModel(records = new Map()) {
  return {
    records,
    async count({ bucket }) { return [...records.values()].filter((record) => record.bucket === bucket).length; },
    create(values) {
      return { async fetch() {
        if (records.has(values.id)) throw Object.assign(new Error('Duplicate counter.'), { code: 'E_UNIQUE' });
        records.set(values.id, values);
        return values;
      } };
    },
  };
}

test('place queries require bounded plain text and normalize pasted whitespace', () => {
  assert.equal(queryFor('  Central   Park, New York  '), 'Central Park, New York');
  for (const query of [undefined, null, {}, [], 123, '', 'ab', 'x'.repeat(201), 'bad\u0000address']) {
    assert.throws(() => queryFor(query), (error) => error.status === 400);
  }
});

test('Photon endpoint is server configuration and requires HTTPS without credentials or fragments', () => {
  assert.equal(getPhotonSearchUrl({}), 'https://photon.komoot.io/api/');
  assert.equal(getPhotonSearchUrl({ PHOTON_SEARCH_URL: 'https://geocoder.example.test/custom-api?key=server-only' }), 'https://geocoder.example.test/custom-api?key=server-only');
  for (const PHOTON_SEARCH_URL of ['http://geocoder.example.test/api/', 'file:///private', '/api/', 'https://user:password@geocoder.example.test/api/', 'https://geocoder.example.test/api/#fragment']) {
    assert.throws(() => getPhotonSearchUrl({ PHOTON_SEARCH_URL }), /PHOTON_SEARCH_URL/);
  }
});

test('provider data is reduced to at most five safe unique named locations with longitude/latitude in the right order', () => {
  const first = fixture.features[0];
  const data = { ...fixture, features: [
    first, first,
    { ...first, geometry: { type: 'Point', coordinates: [0, 0] }, properties: { housenumber: '123', street: 'Main Street', city: 'Exampletown' } },
    ...[[200, 40], [10, 91], [NaN, 40], ['10', '40']].map((coordinates) => ({ ...first, geometry: { type: 'Point', coordinates } })),
    { ...first, geometry: { type: 'LineString', coordinates: [10, 40] } },
    { ...first, properties: {} },
    ...Array.from({ length: 6 }, (unused, index) => ({ ...first, geometry: { type: 'Point', coordinates: [index, 20] }, properties: { name: `Place ${index}` } })),
  ] };
  const results = normalizeResults(data);
  assert.equal(results.length, 5);
  assert.deepEqual(Object.keys(results[0]).sort(), ['id', 'label', 'lat', 'lng']);
  assert.match(results[0].id, /^[a-f0-9]{24}$/);
  assert.equal(results[0].label, 'Central Park, New York, United States');
  assert.equal(results[0].lat, 40.7829);
  assert.equal(results[0].lng, -73.9654);
  assert.equal(results[1].label, '123 Main Street, Exampletown');
  assert.equal(results[1].lat, 0);
  assert.equal(results[1].lng, 0);
  assert.deepEqual(normalizeResults({ type: 'FeatureCollection', features: [] }), []);
  assert.throws(() => normalizeResults({ private: 'provider-secret' }));
  const long = normalizeResults({ ...fixture, features: [{ ...first, properties: { name: 'n'.repeat(1000), city: 'c'.repeat(1000), country: 'z'.repeat(1000) } }] });
  assert.equal(long[0].label.length, 300);
});

test('lookups encode the query and never forward browser credentials or follow redirects', async () => {
  const fetcher = mock.fn(async () => response());
  const search = createLocationSearch({ fetcher, minIntervalMs: 0, now: () => NOW });
  const results = await search('Central Park & near street', counterModel());
  assert.equal(results.length, 1);
  const [url, options] = fetcher.mock.calls[0].arguments;
  assert.equal(url.origin, 'https://photon.komoot.io');
  assert.equal(url.searchParams.get('q'), 'Central Park & near street');
  assert.equal(url.searchParams.get('limit'), '5');
  assert.equal(url.searchParams.get('lang'), 'en');
  assert.equal(options.redirect, 'error');
  assert.equal(options.headers.Authorization, undefined);
  assert.equal(options.headers.Cookie, undefined);
  assert.match(options.headers['User-Agent'], /LostPawNetwork/);
  assert.equal(options.signal.aborted, false);
});

test('lookups share in-flight work and cached results until expiry', async () => {
  let resolve;
  let current = NOW;
  const fetcher = mock.fn(() => new Promise((done) => { resolve = done; }));
  const search = createLocationSearch({ fetcher, minIntervalMs: 0, now: () => current });
  const model = counterModel();
  const first = search('Central Park', model);
  const second = search(' CENTRAL   PARK ', model);
  await new Promise((done) => setImmediate(done));
  assert.equal(fetcher.mock.callCount(), 1);
  resolve(response());
  assert.deepEqual(await first, await second);
  assert.deepEqual(await search('Central Park', model), await first);
  assert.equal(fetcher.mock.callCount(), 1);
  current += 15 * 60 * 1000 + 1;
  const expired = search('Central Park', model);
  await new Promise((done) => setImmediate(done));
  assert.equal(fetcher.mock.callCount(), 2);
  resolve(response());
  await expired;
});

test('cache size and in-flight requests remain bounded', async () => {
  let current = NOW;
  const fetcher = mock.fn(async () => response());
  const search = createLocationSearch({ fetcher, minIntervalMs: 0, now: () => current });
  const model = counterModel();
  for (let index = 0; index <= 200; index += 1) {
    current = NOW + Math.floor(index / 25) * 60000;
    await search(`Place ${index}`, model);
  }
  await search('Place 0', model);
  assert.equal(fetcher.mock.callCount(), 202);

  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const blocked = createLocationSearch({ fetcher: async () => { await gate; return response(); }, minIntervalMs: 0, now: () => NOW });
  const pending = Array.from({ length: 5 }, (unused, index) => blocked(`Pending ${index}`, counterModel()));
  await assert.rejects(blocked('Another pending place', counterModel()), (error) => error.status === 429 && error.retryAfter === 1);
  release();
  await Promise.all(pending);
});

test('uncached lookups across workers share one provider budget while cache hits keep working', async () => {
  const model = counterModel();
  const fetcher = mock.fn(async () => response());
  const first = createLocationSearch({ fetcher, minIntervalMs: 0, now: () => NOW });
  const second = createLocationSearch({ fetcher, minIntervalMs: 0, now: () => NOW });
  for (let index = 0; index < 30; index += 1) await (index % 2 ? first : second)(`Shared place ${index}`, model);
  await assert.rejects(first('Blocked new place', model), (error) => error.status === 429 && error.retryAfter === 60);
  await first('Shared place 1', model);
  assert.equal(fetcher.mock.callCount(), 30);
  assert.doesNotMatch(JSON.stringify([...model.records.values()]), /Shared place|Blocked new place/);
});

test('requests are spaced without blocking cache hits and failures can be retried', async () => {
  const waits = [];
  const fetcher = mock.fn(async () => response());
  const search = createLocationSearch({ fetcher, now: () => NOW, wait: async (delay) => { waits.push(delay); } });
  const model = counterModel();
  await search('First place', model);
  await search('Second place', model);
  await search('First place', model);
  assert.deepEqual(waits, [1000]);
  const failed = mock.fn(async () => { throw new Error('private-upstream-password'); });
  const retry = createLocationSearch({ fetcher: failed, minIntervalMs: 0, now: () => NOW });
  await assert.rejects(retry('Retry place', model));
  await assert.rejects(retry('Retry place', model));
  assert.equal(failed.mock.callCount(), 2);
});

test('timeouts abort the provider and unsafe or oversized responses are rejected', async () => {
  const timeout = createLocationSearch({ timeoutMs: 5, minIntervalMs: 0, now: () => NOW, fetcher: (unusedUrl, { signal }) => new Promise((unusedResolve, reject) => {
    signal.addEventListener('abort', () => reject(new Error('Timed out.')), { once: true });
  }) });
  await assert.rejects(timeout('Timeout place', counterModel()), /Timed out/);
  for (const providerResponse of [
    response({}, { status: 503 }),
    new Response('<html>private-error</html>', { headers: { 'Content-Type': 'text/html' } }),
    new Response('{broken', { headers: { 'Content-Type': 'application/json' } }),
    response({ padding: 'x'.repeat(270000) }),
    response({}, { headers: { 'Content-Type': 'application/json', 'Content-Length': '9999999' } }),
  ]) {
    const search = createLocationSearch({ fetcher: async () => providerResponse, minIntervalMs: 0, now: () => NOW });
    await assert.rejects(search('Invalid response place', counterModel()));
  }
});

test('limiter failures prevent provider traffic', async () => {
  const fetcher = mock.fn();
  const search = createLocationSearch({ fetcher, minIntervalMs: 0 });
  await assert.rejects(search('Somewhere valid', { count: async () => { throw new Error('private-db-detail'); } }));
  assert.equal(fetcher.mock.callCount(), 0);
});
