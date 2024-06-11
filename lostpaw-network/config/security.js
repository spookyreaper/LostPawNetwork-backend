module.exports.security = {
  cors: {
    allRoutes: true,
    allowOrigins: ['http://localhost:5173', 'https://lostpawnetwork.netlify.app'], // Specify your frontend URLs
    allowCredentials: true,
    allowRequestMethods: 'GET, POST, PUT, DELETE, OPTIONS, HEAD',
    allowRequestHeaders: 'content-type, Authorization',
    allowResponseHeaders: 'content-type, Authorization'
  },

  csrf: false,

  hsts: {
    maxAge: 365 * 24 * 60 * 60, // One year in seconds
    includeSubDomains: true,    // Apply HSTS to all subdomains
    preload: true               // Opt-in to preload list for browsers (consider implications)
  },

  csp: {
    useDefaults: true,
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://trusted.cdn.com"],
      styleSrc: ["'self'", "https://trusted.cdn.com", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https://trusted.cdn.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      connectSrc: ["'self'", "wss://yourapp.com", "https://api.yourapp.com"],
      reportUri: '/report-violation',
    }
  }
};
