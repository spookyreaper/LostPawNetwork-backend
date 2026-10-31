const { getDatastoreConfig, getAllowedOrigins, getTrustedProxies, initializeEnvironment } = require('../../lib/runtime');
// Sails can select this file via --prod even when NODE_ENV is unset.
const production = { ...process.env, NODE_ENV: 'production' };
initializeEnvironment(production);

module.exports = {
  models: { migrate: 'safe' },
  datastores: { default: getDatastoreConfig(production) },
  http: { trustProxy: getTrustedProxies(production) },
  security: { cors: { allowOrigins: getAllowedOrigins(production), allowCredentials: false } },
  log: { level: 'warn' },
};
