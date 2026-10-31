const authenticate = require('./isAuthenticated');

// Sails annotates policy functions with their file identity, so use a wrapper.
module.exports = function(req, res, next) {
  return authenticate(req, res, next);
};
