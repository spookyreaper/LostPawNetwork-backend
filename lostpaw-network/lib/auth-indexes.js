function setupError() {
  const error = new Error('Unable to ensure authentication indexes. Check database permissions and resolve duplicate usernames or email addresses before starting the API.');
  error.code = 'E_AUTH_INDEX_SETUP';
  return error;
}

async function ensureAuthIndexes({ models, production = process.env.NODE_ENV === 'production' ||
  (typeof sails !== 'undefined' && sails.config.environment === 'production') }) {
  try {
    const adapter = models.User.getDatastore().config.adapter;
    if (adapter === 'sails-disk' && !production) return;
    if (adapter !== 'sails-mongo') throw setupError();

    const indexes = [
      [models.User, 'email', { name: 'auth_email_unique_ci', unique: true, collation: { locale: 'en', strength: 2 } }],
      [models.User, 'username', { unique: true }],
      [models.AuthSession, 'userId'],
      [models.AuthSession, 'expiresAt'],
      [models.AuthAttempt, 'bucket'],
      [models.AuthAttempt, 'expiresAt'],
    ];
    for (const [model, field, options = {}] of indexes) {
      const datastore = model.getDatastore();
      if (datastore.config.adapter !== 'sails-mongo') throw setupError();
      const column = model.attributes?.[field]?.columnName || field;
      // createIndex is idempotent for an existing matching index. Duplicate
      // account data or incompatible indexes stop startup without deleting data.
      // The named email index can coexist with a legacy binary email_1 index.
      // Numeric expiry timestamps need ordinary indexes, not MongoDB TTL ones.
      await datastore.manager.collection(model.tableName).createIndex(
        { [column]: 1 }, options,
      );
    }
  } catch {
    // MongoDB duplicate/index errors may include account data or server details.
    // Never attach the raw error as a cause that a framework logger can expose.
    throw setupError();
  }
}

module.exports = { ensureAuthIndexes };
