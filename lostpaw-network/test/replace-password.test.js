const { test, mock } = require('node:test');
const assert = require('node:assert/strict');
const { replacePassword } = require('../lib/replace-password');

const USER_ID = 'a'.repeat(24);
const OLD = '$2b$12$' + 'a'.repeat(53);
const NEW = '$2b$12$' + 'b'.repeat(53);
const OTHER = '$2b$12$' + 'c'.repeat(53);

function mongoModel(matchedCount = 1) {
  const updateOne = mock.fn(async () => ({ matchedCount }));
  const collection = mock.fn(() => ({ updateOne }));
  return { model: { tableName: 'user', primaryKey: 'id', attributes: { id: { columnName: '_id' } }, getDatastore: () => ({ config: { adapter: 'sails-mongo' }, manager: { collection } }) }, collection, updateOne };
}

function diskModel(values = { id: USER_ID, password: OLD }) {
  let user = values;
  let queries = 0;
  return {
    getDatastore: () => ({ config: { adapter: 'sails-disk' } }),
    findOne: async () => { queries += 1; await Promise.resolve(); return user && { ...user }; },
    updateOne(criteria) {
      return { async set(valuesToSet) {
        // Model the adapter's fetch-first update semantics, which are unsafe
        // without the surrounding per-user serialization.
        const matched = user && user.id === criteria.id && user.password === criteria.password;
        await Promise.resolve();
        if (!matched) return null;
        user = { ...user, ...valuesToSet };
        return { ...user };
      } };
    },
    current: () => user,
    queries: () => queries,
  };
}

test('Mongo password replacement sends one atomic native match against ID and original password hash', async () => {
  const { model, collection, updateOne } = mongoModel();
  assert.equal(await replacePassword(USER_ID, OLD, NEW, model), true);
  assert.equal(collection.mock.calls[0].arguments[0], 'user');
  const [criteria, update, options] = updateOne.mock.calls[0].arguments;
  assert.equal(criteria._id.toHexString(), USER_ID);
  assert.equal(criteria.password, OLD);
  assert.equal(update.$set.password, NEW);
  assert.ok(Number.isFinite(update.$set.updatedAt));
  assert.deepEqual(options, { writeConcern: { w: 'majority' } });
});

test('Mongo stale password replacements do not report success or silently overwrite newer hashes', async () => {
  const { model } = mongoModel(0);
  assert.equal(await replacePassword(USER_ID, OLD, NEW, model), false);
});

test('Mongo string primary keys remain strings when dontUseObjectIds is enabled', async () => {
  const { model, updateOne } = mongoModel();
  model.dontUseObjectIds = true;
  assert.equal(await replacePassword('legacy-user-id', OLD, NEW, model), true);
  assert.equal(updateOne.mock.calls[0].arguments[0]._id, 'legacy-user-id');
});

test('invalid Mongo ObjectIds fail safely without querying the collection', async () => {
  const { model, collection } = mongoModel();
  assert.equal(await replacePassword('not-an-object-id', OLD, NEW, model), false);
  assert.equal(collection.mock.callCount(), 0);
});

test('invalid hashes, account identifiers, and unsupported datastores cannot write a password', async () => {
  const { model, collection } = mongoModel();
  for (const args of [[{ $ne: null }, OLD, NEW], [USER_ID, { $ne: null }, NEW], [USER_ID, OLD, 'plaintext-password'], [USER_ID, '$2b$99$' + 'a'.repeat(53), NEW], ['', OLD, NEW]]) {
    await assert.rejects(replacePassword(...args, model), /Invalid password replacement/);
  }
  assert.equal(collection.mock.callCount(), 0);
  await assert.rejects(replacePassword(USER_ID, OLD, NEW, { getDatastore: () => ({ config: { adapter: 'unknown' } }) }), /unavailable/);
});

test('parallel disk replacements serialize so only one caller can replace the original hash', async () => {
  const model = diskModel();
  const results = await Promise.all([replacePassword(USER_ID, OLD, NEW, model), replacePassword(USER_ID, OLD, OTHER, model)]);
  assert.deepEqual(results, [true, false]);
  assert.equal(model.current().password, NEW);
  assert.equal(await replacePassword(USER_ID, NEW, OTHER, model), true);
  assert.equal(model.current().password, OTHER);
});

test('disk replacement rejects deleted or stale accounts', async () => {
  assert.equal(await replacePassword(USER_ID, OLD, NEW, diskModel(null)), false);
  assert.equal(await replacePassword(USER_ID, NEW, OTHER, diskModel()), false);
});

test('failed disk writes release the per-user queue so a later replacement can succeed', async () => {
  const model = diskModel();
  const findOne = model.findOne;
  model.findOne = async () => { throw new Error('offline'); };
  await assert.rejects(replacePassword(USER_ID, OLD, NEW, model), /offline/);
  model.findOne = findOne;
  assert.equal(await replacePassword(USER_ID, OLD, NEW, model), true);
});

test('disk password replacement is refused in production', async () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = 'production';
  try {
    await assert.rejects(replacePassword(USER_ID, OLD, NEW, diskModel()), /unavailable/);
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
});
