module.exports.models = {
  datastore: 'default',
  migrate: 'safe',
  schema: true,
  primaryKey: 'id',
  attributes: {
    id: { type: 'string', columnName: '_id' },
    createdAt: { type: 'number', autoCreatedAt: true },
    updatedAt: { type: 'number', autoUpdatedAt: true },
    deleted: { type: 'boolean', defaultsTo: false },
  },
};
