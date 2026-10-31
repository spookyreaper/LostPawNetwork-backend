const { test } = require('node:test');
const assert = require('node:assert/strict');
const { location } = require('../lib/report-validation');

test('stores a validated place label with coordinates without changing legacy locations', () => {
  assert.deepEqual(location({ lat: 0, lng: 0 }), { location: '{"lat":0,"lng":0}', latitude: 0, longitude: 0 });
  const saved = location(JSON.stringify({ lat: 40.7812, lng: -73.9665, label: ' Central Park, New York ', provider: 'ignored' }));
  assert.deepEqual(JSON.parse(saved.location), { lat: 40.7812, lng: -73.9665, label: 'Central Park, New York' });
  assert.equal(saved.latitude, 40.7812);
  assert.equal(saved.longitude, -73.9665);
  assert.equal(JSON.parse(location({ lat: 0, lng: 0, label: ' ' }).location).label, undefined);
});

test('rejects malformed or oversized place labels instead of persisting untrusted objects', () => {
  for (const label of [{ $ne: null }, [], 123, null, 'x'.repeat(301)]) {
    assert.throws(() => location({ lat: 0, lng: 0, label }), { status: 400 });
  }
  assert.throws(() => location({ lat: 200, lng: 0, label: 'A place' }), { status: 400 });
});
