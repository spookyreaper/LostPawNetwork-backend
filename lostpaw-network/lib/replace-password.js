const { ObjectId } = require('mongodb');

const pendingDiskReplacements = new Map();
const bcryptHash = /^\$2[aby]\$(\d{2})\$[./A-Za-z0-9]{53}$/;

function isPasswordHash(value) {
  const match = typeof value === 'string' && bcryptHash.exec(value);
  return !!match && Number(match[1]) >= 4 && Number(match[1]) <= 31;
}

async function onDisk(model, userId, expectedHash, nextHash) {
  // Disk is development-only and runs in one process. Serialize the read/write
  // pair; production uses the datastore's own atomic compare-and-set below.
  const previous = pendingDiskReplacements.get(userId) || Promise.resolve();
  const replacement = previous.catch(() => {}).then(async () => {
    const current = await model.findOne({ id: userId });
    if (!current || current.password !== expectedHash) return false;
    const updated = await model.updateOne({ id: userId, password: expectedHash }).set({ password: nextHash });
    return !!updated;
  });
  pendingDiskReplacements.set(userId, replacement);
  try {
    return await replacement;
  } finally {
    if (pendingDiskReplacements.get(userId) === replacement) pendingDiskReplacements.delete(userId);
  }
}

async function replacePassword(userId, expectedHash, nextHash, model = User) {
  if (typeof userId !== 'string' || !userId.trim() || userId !== userId.trim() || userId.length > 150 || !isPasswordHash(expectedHash) || !isPasswordHash(nextHash)) {
    throw new Error('Invalid password replacement.');
  }
  const datastore = model.getDatastore();
  if (datastore.config.adapter === 'sails-mongo') {
    if (model.dontUseObjectIds !== true && !/^[a-f0-9]{24}$/i.test(userId)) return false;
    const id = model.dontUseObjectIds === true ? userId : new ObjectId(userId);
    const primaryColumn = model.attributes?.[model.primaryKey || 'id']?.columnName || '_id';
    // sails-mongo's fetched Waterline updateOne first selects matching IDs then
    // updates by those IDs. Use the driver directly to keep the password match
    // in the actual write, so a stale login or password change cannot win a race.
    const result = await datastore.manager.collection(model.tableName).updateOne(
      { [primaryColumn]: id, password: expectedHash },
      { $set: { password: nextHash, updatedAt: Date.now() } },
      { writeConcern: { w: 'majority' } },
    );
    return result.matchedCount === 1;
  }
  if (datastore.config.adapter === 'sails-disk' && process.env.NODE_ENV !== 'production') {
    return onDisk(model, userId, expectedHash, nextHash);
  }
  throw new Error('Atomic password changes are unavailable for this datastore.');
}

module.exports = { replacePassword };
