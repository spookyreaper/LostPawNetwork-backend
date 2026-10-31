const { afterEach, beforeEach, test, mock } = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const controller = require('../api/controllers/UserController');
const userModel = require('../api/models/User');

const USER_ID = 'a'.repeat(24);
const OTHER_ID = 'b'.repeat(24);
const SECRET = 'auth-controller-test-secret-with-32-characters';
const passwordHash = bcrypt.hashSync('correct password', 12);
let previousSecret;

function response() {
  return {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    send() { this.sent = true; return this; }
  };
}

function request(body = {}, id = USER_ID) {
  return { body, params: { id }, user: { userId: USER_ID }, auth: { sessionId: 'c'.repeat(64) } };
}

function storedUser(extra = {}) {
  return { id: USER_ID, username: 'Person', email: 'person@example.com', contactInfo: '555-0101', password: passwordHash, internalFlag: true, ...extra };
}

beforeEach(() => {
  previousSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = SECRET;
  global.User = {
    findOne: mock.fn(async () => null),
    create: mock.fn((values) => ({ fetch: async () => storedUser(values) })),
    updateOne: mock.fn(() => ({ set: async (values) => storedUser(values) })),
    destroyOne: mock.fn(async () => storedUser())
  };
  global.AuthSession = { create: mock.fn(async () => {}), destroy: mock.fn(async () => {}), destroyOne: mock.fn(async () => ({})) };
  global.Report = { find: mock.fn(() => ({ populate: async () => [] })), count: mock.fn(async () => 0) };
  global.Pet = { count: mock.fn(async () => 0) };
});

afterEach(() => {
  mock.restoreAll();
  delete global.User;
  delete global.AuthSession;
  delete global.Report;
  delete global.Pet;
  if (previousSecret === undefined) {
    delete process.env.JWT_SECRET;
  } else {
    process.env.JWT_SECRET = previousSecret;
  }
});

test('register hashes the password, generates an ID, normalizes fields, and returns only public user data', async () => {
  const res = response();
  await controller.register(request({ username: ' Person ', email: ' PERSON@EXAMPLE.COM ', password: 'correct password', id: OTHER_ID, deleted: true, accountCreated: 1, admin: true }), res);
  assert.equal(res.statusCode, 201);
  const created = User.create.mock.calls[0].arguments[0];
  assert.match(created.id, /^[a-f0-9]{24}$/);
  assert.notEqual(created.id, OTHER_ID);
  assert.equal(created.username, 'Person');
  assert.equal(created.email, 'person@example.com');
  assert.equal(await bcrypt.compare('correct password', created.password), true);
  assert.deepEqual(Object.keys(created).sort(), ['email', 'id', 'password', 'username']);
  assert.equal(res.body.user.id, created.id);
  assert.equal(res.body.user.password, undefined);
  assert.equal(res.body.user.internalFlag, undefined);
  const claims = jwt.verify(res.body.token, SECRET, { algorithms: ['HS256'] });
  assert.equal(claims.userId, created.id);
  assert.equal(claims.exp - claims.iat, 3600);
  assert.equal(claims.sub, created.id);
  assert.equal(claims.iss, 'lostpaw-network');
  assert.equal(claims.aud, 'lostpaw-network-api');
  assert.match(claims.jti, /^[a-f0-9]{64}$/);
});

for (const [label, body] of [
  ['non-object body', []],
  ['query operator email', { username: 'Person', email: { $ne: null }, password: 'password' }],
  ['object username', { username: {}, email: 'person@example.com', password: 'password' }],
  ['array password', { username: 'Person', email: 'person@example.com', password: ['password'] }],
  ['blank password', { username: 'Person', email: 'person@example.com', password: '  ' }],
  ['multibyte password over bcrypt limit', { username: 'Person', email: 'person@example.com', password: '🐾'.repeat(19) }]
]) {
  test(`register rejects ${label} before reading or writing users`, async () => {
    const res = response();
    await controller.register(request(body), res);
    assert.equal(res.statusCode, 400);
    assert.equal(User.findOne.mock.callCount(), 0);
    assert.equal(User.create.mock.callCount(), 0);
  });
}

test('register returns a conflict for existing users and database uniqueness races', async () => {
  User.findOne = mock.fn(async () => storedUser());
  const existing = response();
  const body = { username: 'Person', email: 'person@example.com', password: 'a valid test password' };
  await controller.register(request(body), existing);
  assert.equal(existing.statusCode, 409);
  assert.equal(User.create.mock.callCount(), 0);
  User.findOne = mock.fn(async () => null);
  User.create = mock.fn(() => ({ fetch: async () => { throw Object.assign(new Error('private database detail'), { code: 'E_UNIQUE' }); } }));
  const race = response();
  await controller.register(request(body), race);
  assert.equal(race.statusCode, 409);
  assert.doesNotMatch(JSON.stringify(race.body), /private database detail/);
});

test('registration requires signing configuration before writing an account', async () => {
  delete process.env.JWT_SECRET;
  const res = response();
  await controller.register(request({ username: 'Person', email: 'person@example.com', password: 'a valid test password' }), res);
  assert.equal(res.statusCode, 503);
  assert.equal(User.create.mock.callCount(), 0);
});

test('login preserves its frontend contract and normalizes the lookup email', async () => {
  User.findOne = mock.fn(async () => storedUser());
  const res = response();
  await controller.login(request({ email: ' PERSON@EXAMPLE.COM ', password: 'correct password' }), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.userId, USER_ID);
  assert.equal(jwt.verify(res.body.token, SECRET).userId, USER_ID);
  assert.deepEqual(User.findOne.mock.calls[0].arguments[0], { email: 'person@example.com' });
  assert.equal(res.body.user, undefined);
  assert.doesNotMatch(JSON.stringify(res.body), /password|internalFlag/);
});

test('login uses the same unauthorized response for unknown accounts and incorrect passwords', async () => {
  const unknown = response();
  await controller.login(request({ email: 'person@example.com', password: 'wrong' }), unknown);
  User.findOne = mock.fn(async () => storedUser());
  const wrong = response();
  await controller.login(request({ email: 'person@example.com', password: 'wrong' }), wrong);
  assert.equal(unknown.statusCode, 401);
  assert.equal(wrong.statusCode, 401);
  assert.deepEqual(unknown.body, wrong.body);
});

test('login rejects operator objects instead of passing them to the database', async () => {
  const res = response();
  await controller.login(request({ email: { $regex: '.*' }, password: 'password' }), res);
  assert.equal(res.statusCode, 400);
  assert.equal(User.findOne.mock.callCount(), 0);
});

test('controller errors do not disclose database messages or credentials', async () => {
  User.findOne = mock.fn(async () => { throw new Error('mongodb://private-credentials@host/account'); });
  const res = response();
  await controller.login(request({ email: 'person@example.com', password: 'password' }), res);
  assert.equal(res.statusCode, 500);
  assert.deepEqual(res.body, { message: 'Unable to log in.' });
});

test('profile updates require reauthentication for email and strip private response data', async () => {
  User.findOne = mock.fn(async () => storedUser());
  const set = mock.fn(async (values) => storedUser(values));
  User.updateOne = mock.fn(() => ({ set }));
  const res = response();
  await controller.update(request({ username: ' Updated ', email: ' NEW@EXAMPLE.COM ', contactInfo: ' 555-0202 ', currentPassword: 'correct password', id: OTHER_ID, password: 'new password', deleted: true, admin: true }), res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(User.updateOne.mock.calls[0].arguments[0], { id: USER_ID });
  assert.deepEqual(set.mock.calls[0].arguments[0], { username: 'Updated', email: 'new@example.com', contactInfo: '555-0202' });
  assert.equal(res.body.user.password, undefined);
  assert.equal(res.body.user.internalFlag, undefined);
});

test('profile update rejects another user ID and unauthenticated requests before writing', async () => {
  const forbidden = response();
  await controller.update(request({ username: 'Changed' }, OTHER_ID), forbidden);
  assert.equal(forbidden.statusCode, 403);
  const unauthenticated = request({ username: 'Changed' });
  delete unauthenticated.user;
  const unauthorized = response();
  await controller.update(unauthenticated, unauthorized);
  assert.equal(unauthorized.statusCode, 401);
  assert.equal(User.updateOne.mock.callCount(), 0);
});

for (const body of [{}, { password: 'replace-hash' }, { username: {} }, { email: [] }, { contactInfo: { phone: '555' } }]) {
  test(`profile update rejects invalid editable data: ${JSON.stringify(body)}`, async () => {
    const res = response();
    await controller.update(request(body), res);
    assert.equal(res.statusCode, 400);
    assert.equal(User.updateOne.mock.callCount(), 0);
  });
}

test('profile completion targets the authenticated user and ignores body ownership fields', async () => {
  const set = mock.fn(async (values) => storedUser(values));
  User.updateOne = mock.fn(() => ({ set }));
  const res = response();
  await controller.completeProfile(request({ id: OTHER_ID, userId: OTHER_ID, username: 'Injected', contactInfo: ' 555-0303 ' }), res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(User.updateOne.mock.calls[0].arguments[0], { id: USER_ID });
  assert.deepEqual(set.mock.calls[0].arguments[0], { contactInfo: '555-0303' });
  assert.equal(res.body.user.password, undefined);
});

test('profile completion requires nonempty scalar contact information', async () => {
  for (const contactInfo of ['', ' ', null, {}, 5550101]) {
    const res = response();
    await controller.completeProfile(request({ contactInfo }), res);
    assert.equal(res.statusCode, 400);
  }
  assert.equal(User.updateOne.mock.callCount(), 0);
});

test('profile response includes category reports with pet data and excludes user secrets', async () => {
  User.findOne = mock.fn(async () => storedUser({ id: OTHER_ID }));
  const populated = [];
  Report.find = mock.fn((criteria) => ({ populate: async (association) => {
    populated.push(association);
    return [{ id: criteria.status, status: criteria.status, pet: { name: 'Paw' } }];
  } }));
  const res = response();
  await controller.getProfile(request({}, OTHER_ID), res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.user.id, OTHER_ID);
  assert.equal(res.body.user.password, undefined);
  assert.equal(res.body.user.internalFlag, undefined);
  assert.equal(res.body.user.email, undefined);
  assert.equal(res.body.user.contactInfo, undefined);
  assert.deepEqual(populated, ['pet', 'pet']);
  assert.equal(res.body.lostReports[0].status, 'lost');
  assert.equal(res.body.foundReports[0].status, 'found');
  assert.deepEqual(Report.find.mock.calls.map((call) => call.arguments[0]), [{ user: OTHER_ID, status: 'lost' }, { user: OTHER_ID, status: 'found' }]);
});

test('single user lookup strips password and internal fields', async () => {
  User.findOne = mock.fn(async () => storedUser());
  const res = response();
  await controller.findOne(request(), res);
  assert.deepEqual(res.body, { id: USER_ID, username: 'Person', email: 'person@example.com', contactInfo: '555-0101' });
});

test('unknown profiles return404 and malformed profile IDs never become query operators', async () => {
  const missing = response();
  await controller.getProfile(request(), missing);
  assert.equal(missing.statusCode, 404);
  const invalid = response();
  await controller.findOne(request({}, { $ne: null }), invalid);
  assert.equal(invalid.statusCode, 400);
  assert.equal(User.findOne.mock.callCount(), 1);
});

test('only an account owner with their current password can delete it', async () => {
  User.findOne = mock.fn(async () => storedUser());
  const forbidden = response();
  await controller.destroy(request({}, OTHER_ID), forbidden);
  assert.equal(forbidden.statusCode, 403);
  assert.equal(User.destroyOne.mock.callCount(), 0);
  const own = response();
  await controller.destroy(request({ currentPassword: 'correct password' }), own);
  assert.equal(own.statusCode, 204);
  assert.deepEqual(User.destroyOne.mock.calls[0].arguments[0], { id: USER_ID });
});

for (const [resource, reportCount, petCount] of [['reports', 1, 0], ['pets', 0, 1]]) {
  test(`account deletion preserves the account while owned ${resource} remain`, async () => {
    User.findOne = mock.fn(async () => storedUser());
    Report.count = mock.fn(async () => reportCount);
    Pet.count = mock.fn(async () => petCount);
    const res = response();
    await controller.destroy(request({ currentPassword: 'correct password' }), res);
    assert.equal(res.statusCode, 409);
    assert.equal(User.destroyOne.mock.callCount(), 0);
    assert.deepEqual(Report.count.mock.calls[0].arguments[0], { user: USER_ID });
    assert.deepEqual(Pet.count.mock.calls[0].arguments[0], { user: USER_ID });
  });
}

test('account deletion does not continue when relationship checks fail', async () => {
  User.findOne = mock.fn(async () => storedUser());
  Report.count = mock.fn(async () => { throw new Error('private database detail'); });
  const res = response();
  await controller.destroy(request({ currentPassword: 'correct password' }), res);
  assert.equal(res.statusCode, 500);
  assert.equal(User.destroyOne.mock.callCount(), 0);
  assert.doesNotMatch(JSON.stringify(res.body), /private database detail/);
});

test('logout revokes its persisted session without requiring a cookie session', async () => {
  const res = response();
  await controller.logout(request(), res);
  assert.deepEqual(AuthSession.destroyOne.mock.calls[0].arguments[0], { id: 'c'.repeat(64), userId: USER_ID });
  assert.equal(res.statusCode, 204);
});

test('User JSON serialization does not depend on global lodash and permits only public fields', () => {
  const user = storedUser({ resetToken: 'private', admin: true, accountCreated: 123 });
  const json = userModel.customToJSON.call(user);
  assert.deepEqual(json, { id: USER_ID, username: 'Person', email: 'person@example.com', contactInfo: '555-0101', accountCreated: 123 });
});

test('email changes require the current password and never write on failed verification', async () => {
  User.findOne = mock.fn(async () => storedUser());
  const missing = response();
  await controller.update(request({ email: 'different@example.com' }), missing);
  assert.equal(missing.statusCode, 400);
  const wrong = response();
  await controller.update(request({ email: 'different@example.com', currentPassword: 'incorrect' }), wrong);
  assert.equal(wrong.statusCode, 401);
  assert.equal(User.updateOne.mock.callCount(), 0);
  const unchanged = response();
  await controller.update(request({ username: 'Updated', email: 'PERSON@example.com' }), unchanged);
  assert.equal(unchanged.statusCode, 200);
});

test('account deletion requires reauthentication and revokes all sessions after deletion', async () => {
  User.findOne = mock.fn(async () => storedUser());
  for (const [body, status] of [[{}, 400], [{ currentPassword: 'incorrect' }, 401]]) {
    const res = response();
    await controller.destroy(request(body), res);
    assert.equal(res.statusCode, status);
  }
  assert.equal(User.destroyOne.mock.callCount(), 0);
  const res = response();
  await controller.destroy(request({ currentPassword: 'correct password' }), res);
  assert.equal(res.statusCode, 204);
  assert.deepEqual(AuthSession.destroy.mock.calls[0].arguments[0], { userId: USER_ID });
});

test('login fails closed if session persistence is unavailable', async () => {
  User.findOne = mock.fn(async () => storedUser());
  AuthSession.create = mock.fn(async () => { throw new Error('private datastore detail'); });
  const res = response();
  await controller.login(request({ email: 'person@example.com', password: 'correct password' }), res);
  assert.equal(res.statusCode, 500);
  assert.equal(res.body.token, undefined);
  assert.doesNotMatch(JSON.stringify(res.body), /private datastore detail/);
});

test('logout fails closed and allows retry if revocation cannot be saved', async () => {
  AuthSession.destroyOne = mock.fn(async () => { throw new Error('private datastore detail'); });
  const res = response();
  await controller.logout(request(), res);
  assert.equal(res.statusCode, 503);
  assert.doesNotMatch(JSON.stringify(res.body), /private datastore detail/);
});
