const { initializeEnvironment } = require('../lib/runtime');
const { ensureAuthIndexes } = require('../lib/auth-indexes');

module.exports.bootstrap = async function() {
  initializeEnvironment();
  await ensureAuthIndexes({
    models: { User, AuthSession, AuthAttempt },
    production: process.env.NODE_ENV === 'production' || sails.config.environment === 'production',
  });
  // A read works with both the local development store and MongoDB.
  await User.count();
};
