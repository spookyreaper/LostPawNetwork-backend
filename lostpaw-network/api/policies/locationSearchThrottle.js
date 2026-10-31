const { throttleAuthentication } = require('../../lib/auth-throttle');

module.exports = async function(req, res, next) {
  try {
    await throttleAuthentication(req, 'location', sails.models.authattempt);
  } catch (error) {
    if (error.status === 429) {
      res.set('Retry-After', String(error.retryAfter));
      return res.status(429).json({ message: 'Too many location searches. Please wait before searching again.' });
    }
    return res.status(503).json({ message: 'Location search is unavailable. You can still choose a point on the map.' });
  }
  return next();
};
