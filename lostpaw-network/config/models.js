// config/models.js
module.exports.models = {
  // Your app's default connection (see config/datastores.js)
  datastore: 'default',

  // Automatically create database tables/collections
  migrate: 'alter',

  // Whether the framework should automatically track changes to your models
  // (automatically adds createdAt and updatedAt fields)
  schema: true,

  // Default settings for all models
  attributes: {
    // To include createdAt and updatedAt timestamps
    createdAt: { type: 'number', autoCreatedAt: true },
    updatedAt: { type: 'number', autoUpdatedAt: true },

    // To logically delete records instead of removing them from the database
    deleted: { type: 'boolean', defaultsTo: false }
  }
};
