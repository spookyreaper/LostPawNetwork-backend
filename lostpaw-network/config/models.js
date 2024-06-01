// config/models.js
module.exports.models = {
  datastore: 'default',
  migrate: 'alter',

  attributes: {
    id: {
      type: 'string',
      unique: true,
      columnName: '_id',
      required: true
    },
    createdAt: { type: 'number', autoCreatedAt: true },
    updatedAt: { type: 'number', autoUpdatedAt: true },
    deleted: { type: 'boolean', defaultsTo: false }
  }
};
