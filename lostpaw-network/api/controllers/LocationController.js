const { searchPlaces } = require('../../lib/location-search');

module.exports = {
  search: async function(req, res) {
    try {
      const body = req.body;
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return res.status(400).json({ message: 'Enter an address or place name.' });
      }
      const results = await searchPlaces(body.query, sails.models.authattempt);
      return res.json({ results });
    } catch (error) {
      if (error.status === 400) return res.status(400).json({ message: error.message });
      if (error.status === 429) {
        res.set('Retry-After', String(error.retryAfter || 1));
        return res.status(429).json({ message: 'Location search is busy. Please wait a moment and try again.' });
      }
      return res.status(503).json({ message: 'Location search is unavailable. You can still choose a point on the map.' });
    }
  },
};
