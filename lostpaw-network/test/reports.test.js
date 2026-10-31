const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const ReportController = require('../api/controllers/ReportController');
const PetController = require('../api/controllers/PetController');
const isReportOwner = require('../api/policies/isReportOwner');
const isPetOwner = require('../api/policies/isPetOwner');
const { getUploadDirectory, uploadPetPhoto } = require('../lib/uploads');

let temporary;
let previousUploadDir;
const png = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13]);

function response() {
  return {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; this.ended = true; return this; },
    send() { this.ended = true; return this; },
  };
}

function query(value, calls = []) {
  return {
    populate(name) { calls.push(['populate', name]); return this; },
    sort(valueToSort) { calls.push(['sort', valueToSort]); return this; },
    then(resolve, reject) { return Promise.resolve(value).then(resolve, reject); },
  };
}

function uploadRequest(bytes = png, body = {}) {
  const req = { user: { userId: 'owner' }, body, params: {} };
  req.file = (field) => {
    assert.equal(field, 'petPhoto');
    req.uploadCount = (req.uploadCount || 0) + 1;
    return { upload(options, callback) {
      req.uploadOptions = options;
      setImmediate(async () => {
        try {
          const filename = await new Promise((resolve, reject) => options.saveAs({ filename: '../../attack.html' }, (error, value) => error ? reject(error) : resolve(value)));
          const fd = path.join(options.dirname, filename);
          await fs.writeFile(fd, bytes);
          callback(null, [{ fd, type: 'text/html', filename: '../../attack.html' }]);
        } catch (error) {
          callback(error);
        }
      });
    } };
  };
  return req;
}

function validBody(overrides = {}) {
  return {
    petName: 'Milo', description: 'Found near the park', location: '{"lat":0,"lng":0}',
    contactInfo: '555-0101', animalType: 'cat', category: 'cat', breed: 'Mixed', color: 'Black', age: '0', status: 'found',
    ...overrides,
  };
}

test.beforeEach(async () => {
  temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'lostpaw-reports-'));
  previousUploadDir = process.env.UPLOAD_DIR;
  process.env.UPLOAD_DIR = path.join(temporary, 'uploads');
  global.sails = { config: { appPath: temporary, custom: {} }, log: { error() {} } };
});

test.afterEach(async () => {
  delete global.Report;
  delete global.Pet;
  delete global.sails;
  if (previousUploadDir === undefined) { delete process.env.UPLOAD_DIR; }
  else { process.env.UPLOAD_DIR = previousUploadDir; }
  await fs.rm(temporary, { recursive: true, force: true });
});

test('creates matching report/pet attributes, zero coordinates and age with authenticated ownership', async () => {
  let petValues;
  let reportValues;
  global.Pet = { create(values) { petValues = values; return { fetch: async () => values }; } };
  global.Report = { create(values) { reportValues = values; return { fetch: async () => values }; } };
  const req = uploadRequest(png, validBody({ user: 'attacker', userId: 'attacker' }));
  const res = response();
  await ReportController.create(req, res);
  assert.equal(res.statusCode, 201);
  assert.equal(petValues.user, 'owner');
  assert.equal(reportValues.user, 'owner');
  assert.equal(petValues.age, 0);
  assert.equal(reportValues.latitude, 0);
  assert.equal(reportValues.longitude, 0);
  assert.equal(reportValues.animalType, 'cat');
  assert.equal(reportValues.category, 'cat');
  assert.equal(reportValues.petName, 'Milo');
  assert.equal(reportValues.pet, petValues.id);
  assert.match(petValues.id, /^[a-f0-9]{24}$/);
  assert.match(petValues.photoURL, /^\/images\/pets\/[a-f0-9]{24}\.png$/);
  assert.equal(req.uploadOptions.maxBytes, 10000000);
  assert.deepEqual(await fs.readdir(getUploadDirectory()), [path.basename(petValues.photoURL)]);
});

test('rejects malformed location or mismatched categories before receiving a file', async () => {
  for (const body of [validBody({ location: '{broken' }), validBody({ location: '{"lat":null,"lng":0}' }), validBody({ category: 'dog' }), validBody({ age: '-1' })]) {
    const req = uploadRequest(png, body);
    const res = response();
    await ReportController.create(req, res);
    assert.equal(res.statusCode, 400);
    assert.equal(req.uploadCount, undefined);
  }
});

test('rejects executable/non-image content and removes staged files', async () => {
  const req = uploadRequest(Buffer.from('<html><script>alert(1)</script></html>'), validBody());
  const res = response();
  await ReportController.create(req, res);
  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /JPEG/);
  assert.deepEqual(await fs.readdir(getUploadDirectory()), []);
});

test('awaits asynchronous model failures and removes the uploaded photo', async () => {
  global.Pet = { create() { return { fetch: async () => { throw new Error('private database credentials'); } }; } };
  const res = response();
  await ReportController.create(uploadRequest(png, validBody()), res);
  assert.equal(res.statusCode, 500);
  assert.equal(res.ended, true);
  assert.doesNotMatch(JSON.stringify(res.body), /credentials/);
  assert.deepEqual(await fs.readdir(getUploadDirectory()), []);
});

test('compensates the new pet when report creation fails and removes its photo', async () => {
  let petId;
  let removed;
  global.Pet = {
    create(values) { petId = values.id; return { fetch: async () => values }; },
    async destroyOne(criteria) { removed = criteria; },
  };
  global.Report = { create() { return { fetch: async () => { throw new Error('write failed'); } }; } };
  const res = response();
  await ReportController.create(uploadRequest(png, validBody()), res);
  assert.equal(res.statusCode, 500);
  assert.deepEqual(removed, { id: petId });
  assert.deepEqual(await fs.readdir(getUploadDirectory()), []);
});

test('public report reads do not expose populated user secrets and order recent reports first', async () => {
  const calls = [];
  const report = {
    id: 'report', description: 'Found cat', status: 'found', secret: 'hidden',
    user: { id: 'owner', username: 'person', email: 'private@example.com', password: 'hash' },
    pet: { id: 'pet', name: 'Milo', user: { id: 'owner', email: 'private@example.com', password: 'hash' } },
  };
  global.Report = { find: () => query([report], calls), findOne: () => query(report, calls) };
  const list = response();
  await ReportController.find({}, list);
  assert.deepEqual(calls, [['populate', 'pet'], ['sort', 'createdAt DESC']]);
  assert.deepEqual(list.body[0].user, { id: 'owner', username: 'person' });
  assert.equal(list.body[0].pet.user, 'owner');
  assert.doesNotMatch(JSON.stringify(list.body), /password|hash|private@example|secret/);
  const detail = response();
  await ReportController.findOne({ params: { id: 'report' } }, detail);
  assert.doesNotMatch(JSON.stringify(detail.body), /password|private@example/);
});

test('normalizes plural category aliases and rejects unsupported category filters', async () => {
  let criteria;
  global.Report = { find(value) { criteria = value; return query([]); } };
  const res = response();
  await ReportController.findFoundByCategory({ params: { category: 'dogs' } }, res);
  assert.deepEqual(criteria, { status: 'found', category: { in: ['dog', 'dogs'] } });
  const invalid = response();
  await ReportController.findLostByCategory({ params: { category: 'lizard' } }, invalid);
  assert.equal(invalid.statusCode, 400);
});

test('requires ownership for report updates and whitelists fields with owner-scoped writes', async () => {
  let write;
  global.Report = {
    findOne: () => query({ id: 'report', user: 'owner' }),
    updateOne(criteria) { return { set: async (values) => { write = { criteria, values }; return { id: 'report', ...values, user: 'owner' }; } }; },
  };
  const denied = response();
  await ReportController.update({ user: { userId: 'other' }, params: { id: 'report' }, body: { description: 'Changed' } }, denied);
  assert.equal(denied.statusCode, 403);
  assert.equal(write, undefined);
  const res = response();
  await ReportController.update({ user: { userId: 'owner' }, params: { id: 'report' }, body: { description: 'Changed', status: 'lost', location: '{"lat":2,"lng":3}', id: 'stolen', user: 'other', pet: 'other', photoUrls: ['evil'] } }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(write, { criteria: { id: 'report', user: 'owner' }, values: { description: 'Changed', status: 'lost', location: '{"lat":2,"lng":3}', latitude: 2, longitude: 3 } });
});

test('blocks report deletion by another user without relying on a policy', async () => {
  let destroyed = false;
  global.Report = { findOne: () => query({ id: 'report', user: 'owner' }), destroyOne: async () => { destroyed = true; } };
  const res = response();
  await ReportController.destroy({ user: { userId: 'other' }, params: { id: 'report' } }, res);
  assert.equal(res.statusCode, 403);
  assert.equal(destroyed, false);
});

test('ownership policies use JWT context, accept populated owners and catch database failures', async () => {
  let nextCalls = 0;
  global.Report = { findOne: () => query({ id: 'report', user: { id: 'owner' } }) };
  global.Pet = { findOne: () => query({ id: 'pet', user: 'owner' }) };
  const req = { user: { userId: 'owner' }, params: { id: 'id' } };
  await isReportOwner(req, response(), () => { nextCalls += 1; });
  await isPetOwner(req, response(), () => { nextCalls += 1; });
  assert.equal(nextCalls, 2);
  const anonymous = response();
  await isReportOwner({ params: { id: 'id' } }, anonymous, () => { nextCalls += 1; });
  assert.equal(anonymous.statusCode, 401);
  global.Pet.findOne = async () => { throw new Error('database failed'); };
  const failure = response();
  await isPetOwner(req, failure, () => { nextCalls += 1; });
  assert.equal(failure.statusCode, 500);
  assert.equal(nextCalls, 2);
});

test('pet creation assigns authenticated user and generated ID instead of mass assigning body fields', async () => {
  let values;
  global.Pet = { create(input) { values = input; return { fetch: async () => input }; } };
  const res = response();
  await PetController.create({ user: { userId: 'owner' }, body: { id: 'injected', user: 'other', userId: 'other', name: 'Milo', species: 'cat', breed: 'Mixed', color: 'Black', age: 0, photoURL: '/images/pets/photo.png' } }, res);
  assert.equal(res.statusCode, 201);
  assert.match(values.id, /^[a-f0-9]{24}$/);
  assert.equal(values.user, 'owner');
  assert.equal(values.userId, undefined);
});

test('pet lookup exists and pet edits synchronize category/name in associated reports', async () => {
  let sync;
  let update;
  global.Pet = {
    findOne: () => query({ id: 'pet', user: 'owner', name: 'Before' }),
    updateOne(criteria) { return { set: async (values) => { update = { criteria, values }; return { id: 'pet', ...values, user: 'owner' }; } }; },
  };
  global.Report = { update(criteria) { return { set: async (values) => { sync = { criteria, values }; } }; } };
  const lookup = response();
  await PetController.findOne({ params: { id: 'pet' } }, lookup);
  assert.equal(lookup.body.name, 'Before');
  const res = response();
  await PetController.update({ user: { userId: 'owner' }, params: { id: 'pet' }, body: { name: 'After', species: 'dog', user: 'other', id: 'injected' } }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(update, { criteria: { id: 'pet', user: 'owner' }, values: { name: 'After', species: 'dog' } });
  assert.deepEqual(sync, { criteria: { pet: 'pet', user: 'owner' }, values: { petName: 'After', animalType: 'dog', category: 'dog' } });
});

test('refuses deleting pets still referenced by reports', async () => {
  global.Pet = { findOne: () => query({ id: 'pet', user: 'owner' }) };
  global.Report = { count: async () => 1 };
  const res = response();
  await PetController.destroy({ user: { userId: 'owner' }, params: { id: 'pet' } }, res);
  assert.equal(res.statusCode, 409);
});

test('standalone photo upload uses byte-derived safe extension and returns the frontend URL contract', async () => {
  const res = response();
  await PetController.uploadPhoto(uploadRequest(), res);
  assert.equal(res.statusCode, 200);
  assert.match(res.body.url, /^\/images\/pets\/[a-f0-9]{24}\.png$/);
  assert.equal(res.body.url, res.body.photoURL);
});

test('upload errors and missing files resolve without hanging and leave no staging directories', async () => {
  for (const failure of [null, { code: 'E_EXCEEDS_UPLOAD_LIMIT' }]) {
    const req = { file: () => ({ upload(options, callback) { setImmediate(() => callback(failure, [])); } }) };
    await assert.rejects(uploadPetPhoto(req), (error) => error.status === (failure ? 413 : 400));
    assert.deepEqual(await fs.readdir(getUploadDirectory()), []);
  }
});


test('category endpoints include both canonical and legacy plural report categories', async () => {
  const reports = [
    { id: 'canonical', status: 'lost', category: 'cat' },
    { id: 'legacy', status: 'lost', category: 'cats' },
    { id: 'other-species', status: 'lost', category: 'dog' },
    { id: 'other-status', status: 'found', category: 'cats' },
  ];
  global.Report = { find(criteria) {
    assert.deepEqual(criteria, { status: 'lost', category: { in: ['cat', 'cats'] } });
    return query(reports.filter((report) => report.status === criteria.status && criteria.category.in.includes(report.category)));
  } };
  for (const category of ['cat', 'cats']) {
    const res = response();
    await ReportController.findLostByCategory({ params: { category } }, res);
    assert.deepEqual(res.body.map((report) => report.id), ['canonical', 'legacy']);
  }
});
