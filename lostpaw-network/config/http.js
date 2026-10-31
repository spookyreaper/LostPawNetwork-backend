const skipper = require('skipper');
const { getTrustedProxies } = require('../lib/runtime');
const isProductionRequest = (req) => process.env.NODE_ENV === 'production' || req._sails?.config.environment === 'production';

const bodyParser = skipper({
  limit: '32kb',
  parameterLimit: 100,
  strict: true,
  onBodyParserError: function(error, unusedReq, res, unusedNext) {
    const tooLarge = error.type === 'entity.too.large' || error.status === 413;
    return res.status(tooLarge ? 413 : 400).json({
      message: tooLarge ? 'Request body is too large.' : 'Invalid request body.',
    });
  },
});

module.exports.http = {
  trustProxy: getTrustedProxies(),
  middleware: {
    order: ['securityHeaders', 'requireHttps', 'requireAuthJson', 'bodyParser', 'compress', 'router'],
    securityHeaders: function(req, res, next) {
      res.set('X-Content-Type-Options', 'nosniff');
      res.set('Referrer-Policy', 'no-referrer');
      res.set('Cache-Control', 'no-store');
      res.set('X-Frame-Options', 'DENY');
      res.set('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
      res.removeHeader('X-Powered-By');
      if (isProductionRequest(req) && req.secure) {
        res.set('Strict-Transport-Security', 'max-age=31536000');
      }
      return next();
    },
    requireHttps: function(req, res, next) {
      // A trusted reverse proxy must terminate TLS and replace forwarded headers.
      // Health checks disclose no account data and may use the internal HTTP port.
      if (isProductionRequest(req) && !req.secure && req.path !== '/health') {
        return res.status(403).json({ message: 'HTTPS is required.' });
      }
      return next();
    },
    requireAuthJson: function(req, res, next) {
      const needsJson = (req.method === 'POST' && /^\/user\/(?:login|register|complete-profile)\/?$/i.test(req.path)) ||
        (['PUT', 'DELETE'].includes(req.method) && /^\/user\/[^/]+\/?$/i.test(req.path));
      if (needsJson && !req.is('application/json')) {
        return res.status(415).json({ message: 'Send authentication requests as application/json.' });
      }
      return next();
    },
    bodyParser,
  },
};
