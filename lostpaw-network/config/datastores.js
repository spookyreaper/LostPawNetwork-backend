const { getDatastoreConfig } = require('../lib/runtime');

module.exports.datastores = { default: getDatastoreConfig() };
