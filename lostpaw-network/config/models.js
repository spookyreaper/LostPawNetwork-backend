module.exports.models = {
  datastore: 'default',
  migrate: 'alter',
  
  attributes: {
    createdAt: { type: 'number', autoCreatedAt: true },
    updatedAt: { type: 'number', autoUpdatedAt: true },
    deleted: { type: 'boolean', defaultsTo: false }
  },
  
  primaryKey: '_id', // Ensure the primary key is set correctly
};
