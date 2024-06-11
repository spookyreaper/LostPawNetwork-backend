// config/models.js
module.exports.models = {
  datastore: 'default',
  migrate: 'safe',
  primaryKey: 'id',
  attributes: {
    id: { 
      type: 'string', 
      columnName: '_id', 
      unique: true, 
      required: true 
    },
    createdAt: { type: 'number', autoCreatedAt: true },
    updatedAt: { type: 'number', autoUpdatedAt: true },
    deleted: { type: 'boolean', defaultsTo: false }
  }
};
