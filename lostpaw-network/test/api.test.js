const { before, beforeEach, after, test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const net = require('node:net');
const { Sails } = require('sails');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const { issueToken } = require('../lib/auth-tokens');

let app;
let base;
let directory;
let owner;
let stranger;
let report;
const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jF2kAAAAASUVORK5CYII=', 'base64');
const ownerPassword = 'a-valid-test-password';

async function request(route, { token, json, ...options } = {}) {
  const headers = new Headers(options.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (json) { headers.set('Content-Type', 'application/json'); options.body = JSON.stringify(json); }
  const response = await fetch(`${base}${route}`, { ...options, headers });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: response.status, data, headers: response.headers };
}

function reportForm({ bytes = image, ...overrides } = {}) {
  const form = new FormData();
  const values = {
    petName: 'Nori', description: 'Integration test report', contactInfo: '555-0100',
    animalType: 'cat', breed: 'Mixed', color: 'Black', age: '0.5', status: 'lost', category: 'cat',
    location: JSON.stringify({ lat: 0, lng: 0, label: 'Test meeting point' }), userId: 'attacker-supplied-id', ...overrides,
  };
  for (const [key, value] of Object.entries(values)) form.append(key, value);
  form.append('petPhoto', new Blob([bytes], { type: 'image/png' }), 'nori.png');
  return form;
}

before(async () => {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'lostpaw-api-test-'));
  process.env.NODE_ENV = 'test';
  process.env.DATASTORE_ADAPTER = 'disk';
  process.env.JWT_SECRET = 'integration-test-secret-that-is-not-a-production-key';
  process.env.UPLOAD_DIR = path.join(directory, 'uploads');
  const probe = net.createServer();
  await new Promise((resolve) => probe.listen(0, '127.0.0.1', resolve));
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  app = new Sails();
  await new Promise((resolve, reject) => app.lift({
    appPath: path.resolve(__dirname, '..'), environment: 'test', port, explicitHost: '127.0.0.1',
    hooks: { grunt: false, sockets: false, session: false, views: false },
    datastores: { default: { adapter: 'sails-disk', inMemoryOnly: true } },
    log: { level: 'silent' },
  }, (error) => error ? reject(error) : resolve()));
  base = `http://127.0.0.1:${app.hooks.http.server.address().port}`;
});

after(async () => {
  if (app) await new Promise((resolve) => app.lower(resolve));
  if (directory) await fs.rm(directory, { recursive: true, force: true });
});

beforeEach(async () => {
  // Rate-limit behavior has its own concurrent HTTP tests. Give each unrelated
  // API workflow a fresh attempt budget without touching actual application data.
  await app.models.authattempt.destroy({});
});

test('the API boots without MongoDB and permits only configured frontend origins', async () => {
  const response = await request('/health', { headers: { Origin: 'http://127.0.0.1:5173' } });
  assert.equal(response.status, 200);
  assert.equal(response.data.status, 'ok');
  assert.equal(response.headers.get('access-control-allow-origin'), 'http://127.0.0.1:5173');
  assert.equal(response.headers.get('set-cookie'), null);
  const untrusted = await request('/health', { headers: { Origin: 'https://untrusted.example.test' } });
  assert.notEqual(untrusted.headers.get('access-control-allow-origin'), 'https://untrusted.example.test');
});

test('registration generates IDs, ignores privileged input, and never returns a password', async () => {
  const first = await request('/user/register', { method: 'POST', json: { id: 'attacker-id', username: 'Owner', email: 'OWNER@example.test', password: 'a-valid-test-password', isAdmin: true } });
  assert.equal(first.status, 201);
  assert.match(first.data.user.id, /^[a-f0-9]{24}$/);
  assert.equal(first.data.user.email, 'owner@example.test');
  assert.equal(first.data.user.password, undefined);
  assert.equal(first.data.user.isAdmin, undefined);
  owner = { token: first.data.token, id: first.data.user.id };
  const second = await request('/user/register', { method: 'POST', json: { username: 'Stranger', email: 'stranger@example.test', password: 'another-valid-test-password' } });
  assert.equal(second.status, 201);
  stranger = { token: second.data.token, id: second.data.user.id };
  const duplicate = await request('/user/register', { method: 'POST', json: { username: 'Different', email: 'OWNER@example.test', password: 'a-valid-test-password' } });
  assert.equal(duplicate.status, 409);
});

test('login, protected profiles, and authenticated profile editing use the frontend contract', async () => {
  const login = await request('/user/login', { method: 'POST', json: { email: 'owner@example.test', password: 'a-valid-test-password' } });
  assert.equal(login.status, 200);
  assert.equal(login.data.userId, owner.id);
  const bad = await request('/user/login', { method: 'POST', json: { email: 'owner@example.test', password: 'incorrect' } });
  assert.equal(bad.status, 401);
  assert.equal((await request(`/user/profile/${owner.id}`)).status, 401);
  assert.equal((await request(`/user/${owner.id}`, { method: 'PUT', token: stranger.token, json: { username: 'Stolen' } })).status, 403);
  const saved = await request(`/user/${owner.id}`, { method: 'PUT', token: owner.token, json: { username: 'Updated Owner', contactInfo: '555-0100', password: 'must-not-change', id: stranger.id } });
  assert.equal(saved.status, 200);
  assert.equal(saved.data.user.id, owner.id);
  const profile = await request(`/user/profile/${owner.id}`, { token: owner.token });
  assert.equal(profile.data.user.username, 'Updated Owner');
  assert.equal(profile.data.user.password, undefined);
  assert.deepEqual(profile.data.lostReports, []);
  assert.equal((await request('/user/login', { method: 'POST', json: { email: 'owner@example.test', password: 'a-valid-test-password' } })).status, 200);
});

test('report creation handles actual multipart uploads and derives ownership from the JWT', async () => {
  const created = await request('/report', { method: 'POST', token: owner.token, body: reportForm() });
  assert.equal(created.status, 201);
  report = created.data.report;
  assert.equal(typeof report.user === 'object' ? report.user.id : report.user, owner.id);
  assert.equal(report.category, 'cat');
  assert.equal(report.petName, 'Nori');
  assert.equal(report.latitude, 0);
  assert.equal(report.longitude, 0);
  assert.equal(JSON.parse(report.location).label, 'Test meeting point');
  assert.match(report.photoUrls[0], /^\/images\/pets\/[a-f0-9]{24}\.png$/);
  const photo = await fetch(`${base}${report.photoUrls[0]}`);
  assert.equal(photo.status, 200);
  assert.equal(photo.headers.get('content-type'), 'image/png');
  assert.deepEqual(Buffer.from(await photo.arrayBuffer()), image);
});

test('public report lists, detail, and category routes expose safe populated pet data', async () => {
  const list = await request('/reports');
  assert.equal(list.status, 200);
  assert.equal(list.data.length, 1);
  assert.equal(list.data[0].pet.name, 'Nori');
  assert.equal(JSON.stringify(list.data).includes('password'), false);
  const detail = await request(`/report/${report.id}`);
  assert.equal(detail.status, 200);
  assert.equal(detail.data.pet.name, 'Nori');
  assert.equal((await request('/reports/lost/all')).data.length, 1);
  assert.equal((await request('/reports/lost/cats')).data.length, 1);
  assert.equal((await request('/reports/found/dogs')).data.length, 0);
  assert.equal((await request('/report/not-a-report')).status, 404);
});

test('report and pet mutations reject other users and forbid ownership reassignment', async () => {
  assert.equal((await request(`/user/${owner.id}`, { method: 'DELETE', token: owner.token, json: { currentPassword: ownerPassword } })).status, 409);
  assert.equal((await request(`/report/${report.id}`, { method: 'PUT', token: stranger.token, json: { description: 'Stolen' } })).status, 403);
  assert.equal((await request(`/report/${report.id}`, { method: 'DELETE', token: stranger.token })).status, 403);
  const petId = typeof report.pet === 'object' ? report.pet.id : report.pet;
  assert.equal((await request(`/pet/${petId}`, { method: 'PUT', token: stranger.token, json: { name: 'Stolen' } })).status, 403);
  assert.equal((await request(`/pet/${petId}`, { method: 'DELETE', token: owner.token })).status, 409);
  const updated = await request(`/report/${report.id}`, { method: 'PUT', token: owner.token, json: { description: 'Updated by owner', user: stranger.id } });
  assert.equal(updated.status, 200);
  const detail = await request(`/report/${report.id}`);
  assert.equal(detail.data.description, 'Updated by owner');
  assert.equal(typeof detail.data.user === 'object' ? detail.data.user.id : detail.data.user, owner.id);
});

test('invalid locations, disguised files, and traversal paths are rejected without leftover uploads', async () => {
  const filesBefore = await fs.readdir(process.env.UPLOAD_DIR);
  assert.equal((await request('/report', { method: 'POST', token: owner.token, body: reportForm({ location: '{broken' }) })).status, 400);
  assert.equal((await request('/report', { method: 'POST', token: owner.token, body: reportForm({ bytes: Buffer.from('<script>invalid image</script>') }) })).status, 400);
  assert.deepEqual(await fs.readdir(process.env.UPLOAD_DIR), filesBefore);
  assert.equal((await request('/images/pets/%2e%2e%2fpackage.json')).status, 404);
  assert.equal((await request('/images/pets/.env')).status, 404);
  assert.equal((await request('/user/create?email=blueprint@example.test', { token: owner.token })).status, 404);
  assert.equal((await request('/user/find', { token: owner.token })).status, 404);
});

test('owners can delete their data and deleted-account tokens stop authenticating', async () => {
  const petId = typeof report.pet === 'object' ? report.pet.id : report.pet;
  assert.equal((await request(`/report/${report.id}`, { method: 'DELETE', token: owner.token })).status, 204);
  assert.equal((await request(`/report/${report.id}`)).status, 404);
  assert.equal((await request(`/pet/${petId}`, { method: 'DELETE', token: owner.token })).status, 204);
  assert.equal((await request('/user/logout', { method: 'POST', token: owner.token })).status, 204);
  assert.equal((await request(`/user/${owner.id}`, { token: owner.token })).status, 401);
  const login = await request('/user/login', { method: 'POST', json: { email: 'owner@example.test', password: ownerPassword } });
  assert.equal(login.status, 200);
  assert.equal((await request(`/user/${owner.id}`, { method: 'DELETE', token: login.data.token, json: { currentPassword: ownerPassword } })).status, 204);
  assert.equal((await request(`/user/profile/${stranger.id}`, { token: owner.token })).status, 401);
  assert.equal((await request(`/user/profile/${stranger.id}`, { token: login.data.token })).status, 401);
});

test('forged, unsigned, legacy, and untracked JWTs cannot open a protected profile', async () => {
  const claims = jwt.decode(stranger.token);
  const [header, , signature] = stranger.token.split('.');
  const modified = `${header}.${Buffer.from(JSON.stringify({ ...claims, userId: 'a'.repeat(24), sub: 'a'.repeat(24), admin: true })).toString('base64url')}.${signature}`;
  const tokens = [
    'not-a-token',
    modified,
    jwt.sign(claims, null, { algorithm: 'none' }),
    jwt.sign(claims, process.env.JWT_SECRET, { algorithm: 'HS384' }),
    jwt.sign({ userId: stranger.id }, process.env.JWT_SECRET, { expiresIn: '24h' }),
    jwt.sign({ ...claims, jti: 'c'.repeat(64) }, process.env.JWT_SECRET, { algorithm: 'HS256' }),
  ];
  for (const token of tokens) {
    const result = await request(`/user/profile/${stranger.id}`, { token });
    assert.equal(result.status, 401);
    assert.deepEqual(result.data, { message: 'Invalid or expired token.' });
  }
  const injection = await request('/user/login', { method: 'POST', json: { email: { $ne: null }, password: 'anything' } });
  assert.equal(injection.status, 400);
  assert.equal((await request(`/user/${stranger.id}`, { token: stranger.token })).status, 200);
});

test('new accounts reject weak or oversized passwords without creating a user', async () => {
  const count = await app.models.user.count();
  for (const password of ['too short', 'aaaaaaaaaaaaaaaa', 'password123456789', '🐾'.repeat(19)]) {
    const result = await request('/user/register', { method: 'POST', json: { username: 'Weak account', email: 'weak@example.test', password } });
    assert.equal(result.status, 400);
    assert.equal(result.data.token, undefined);
  }
  assert.equal(await app.models.user.count(), count);
});

test('password changes require the current password and invalidate every previous device session', async () => {
  const password = 'original-integration-passphrase';
  const newPassword = 'replacement-integration-passphrase';
  const email = 'password-security@example.test';
  const registered = await request('/user/register', { method: 'POST', json: { username: 'Password security', email, password } });
  assert.equal(registered.status, 201);
  const userId = registered.data.user.id;
  const second = await request('/user/login', { method: 'POST', json: { email, password } });
  assert.equal(second.status, 200);
  const oldSession = await app.models.authsession.findOne({ id: jwt.decode(registered.data.token).jti });
  const wrong = await request('/user/password', { method: 'PUT', token: registered.data.token, json: { currentPassword: 'wrong password', newPassword } });
  assert.equal(wrong.status, 401);
  assert.equal((await request('/user/password', { method: 'PUT', token: registered.data.token, json: { currentPassword: password, newPassword: 'too short' } })).status, 400);
  assert.equal((await request(`/user/${userId}`, { token: second.data.token })).status, 200);
  const changed = await request('/user/password', { method: 'PUT', token: registered.data.token, json: { currentPassword: password, newPassword } });
  assert.equal(changed.status, 200);
  assert.equal(changed.data.token, undefined);
  assert.equal(await app.models.authsession.count({ userId }), 0);
  for (const token of [registered.data.token, second.data.token]) {
    assert.equal((await request(`/user/${userId}`, { token })).status, 401);
  }
  // Password binding rejects old tokens even if stale records survive cleanup.
  const { id, passwordFingerprint, expiresAt } = oldSession;
  await app.models.authsession.create({ id, userId, passwordFingerprint, expiresAt });
  assert.equal((await request(`/user/${userId}`, { token: registered.data.token })).status, 401);
  assert.equal((await request('/user/login', { method: 'POST', json: { email, password } })).status, 401);
  const fresh = await request('/user/login', { method: 'POST', json: { email, password: newPassword } });
  assert.equal(fresh.status, 200);
  assert.equal((await request(`/user/${userId}`, { token: fresh.data.token })).status, 200);
});

test('email changes and account deletion require reauthentication and hide private profile fields from other users', async () => {
  const password = 'email-integration-passphrase';
  const email = 'email-security@example.test';
  const nextEmail = 'updated-email-security@example.test';
  const registered = await request('/user/register', { method: 'POST', json: { username: 'Email security', email, password } });
  assert.equal(registered.status, 201);
  const token = registered.data.token;
  const id = registered.data.user.id;
  assert.equal((await request(`/user/${id}`, { method: 'PUT', token, json: { email: nextEmail } })).status, 400);
  assert.equal((await request(`/user/${id}`, { method: 'PUT', token, json: { email: nextEmail, currentPassword: 'incorrect' } })).status, 401);
  assert.equal((await request(`/user/${id}`, { method: 'PUT', token, json: { email } })).status, 200);
  const changed = await request(`/user/${id}`, { method: 'PUT', token, json: { email: nextEmail, currentPassword: password, contactInfo: 'private@example.test' } });
  assert.equal(changed.status, 200);
  assert.equal(changed.data.user.email, nextEmail);
  assert.equal((await request('/user/login', { method: 'POST', json: { email, password } })).status, 401);
  assert.equal((await request('/user/login', { method: 'POST', json: { email: nextEmail, password } })).status, 200);
  for (const route of [`/user/${id}`, `/user/profile/${id}`]) {
    const own = await request(route, { token });
    const viewed = await request(route, { token: stranger.token });
    assert.equal(own.status, 200);
    assert.equal(viewed.status, 200);
    const ownUser = own.data.user || own.data;
    const viewedUser = viewed.data.user || viewed.data;
    assert.equal(ownUser.email, nextEmail);
    assert.equal(ownUser.contactInfo, 'private@example.test');
    assert.equal(viewedUser.email, undefined);
    assert.equal(viewedUser.contactInfo, undefined);
    assert.equal(viewedUser.password, undefined);
  }
  assert.equal((await request(`/user/${id}`, { method: 'DELETE', token, json: {} })).status, 400);
  assert.equal((await request(`/user/${id}`, { method: 'DELETE', token, json: { currentPassword: 'incorrect' } })).status, 401);
  assert.equal((await request(`/user/${id}`, { method: 'DELETE', token, json: { currentPassword: password } })).status, 204);
  assert.equal((await request(`/user/${stranger.id}`, { token })).status, 401);
});

test('logout revokes its token immediately while keeping a different session usable', async () => {
  const email = 'logout-security@example.test';
  const password = 'logout-integration-passphrase';
  const registered = await request('/user/register', { method: 'POST', json: { username: 'Logout security', email, password } });
  assert.equal(registered.status, 201);
  const second = await request('/user/login', { method: 'POST', json: { email, password } });
  assert.equal(second.status, 200);
  assert.equal((await request('/user/logout', { method: 'POST', token: registered.data.token })).status, 204);
  assert.equal((await request(`/user/${registered.data.user.id}`, { token: registered.data.token })).status, 401);
  assert.equal((await request('/user/logout', { method: 'POST', token: registered.data.token })).status, 401);
  assert.equal((await request(`/user/${registered.data.user.id}`, { token: second.data.token })).status, 200);
});

test('authentication requires bounded JSON bodies and returns safe parser errors', async () => {
  const notJson = await request('/user/login', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'email=person@example.test&password=example-passphrase' });
  assert.equal(notJson.status, 415);
  const malformed = await request('/user/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"email":' });
  assert.equal(malformed.status, 400);
  assert.deepEqual(malformed.data, { message: 'Invalid request body.' });
  const large = await request('/user/login', { method: 'POST', json: { email: 'person@example.test', password: 'example-passphrase', padding: 'private-sentinel'.repeat(4000) } });
  assert.equal(large.status, 413);
  assert.deepEqual(large.data, { message: 'Request body is too large.' });
  assert.equal(large.headers.get('cache-control'), 'no-store');
  assert.equal(large.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(large.headers.get('x-frame-options'), 'DENY');
  assert.equal(large.headers.get('x-powered-by'), null);
});

test('legacy short passwords still log in and upgrade weak hashes without repeatedly invalidating sessions', async () => {
  const id = 'd'.repeat(24);
  const email = 'legacy-password@example.test';
  const password = 'oldshort';
  const weakHash = await bcrypt.hash(password, 4);
  await app.models.user.create({ id, username: 'Legacy password', email, password: weakHash });
  const oldToken = await issueToken(id, weakHash);
  assert.equal((await request(`/user/${id}`, { token: oldToken })).status, 200);
  const login = await request('/user/login', { method: 'POST', json: { email, password } });
  assert.equal(login.status, 200);
  const upgraded = await app.models.user.findOne({ id });
  assert.equal(bcrypt.getRounds(upgraded.password), 12);
  assert.notEqual(upgraded.password, weakHash);
  assert.equal(await bcrypt.compare(password, upgraded.password), true);
  assert.equal((await request(`/user/${id}`, { token: login.data.token })).status, 200);
  assert.equal((await request(`/user/${id}`, { token: oldToken })).status, 401);
  const second = await request('/user/login', { method: 'POST', json: { email, password } });
  assert.equal(second.status, 200);
  assert.equal((await app.models.user.findOne({ id })).password, upgraded.password);
  assert.equal((await request(`/user/${id}`, { token: login.data.token })).status, 200);
});
