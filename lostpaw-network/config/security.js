const { getAllowedOrigins } = require('../lib/runtime');

module.exports.security = {
  cors: {
    allRoutes: true,
    allowOrigins: getAllowedOrigins(),
    allowCredentials: false,
    allowRequestMethods: 'GET, POST, PUT, DELETE, OPTIONS, HEAD',
    allowRequestHeaders: 'content-type, Authorization',
  },
  // Requests authenticate with an explicit Authorization header, never cookies.
  csrf: false,
};
