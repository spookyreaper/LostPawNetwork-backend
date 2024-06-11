module.exports.security = {
  cors: {
    allRoutes: true,
    allowOrigins: ['https://lostpawnetwork.netlify.app'],
    allowCredentials: true, // Allow credentials if using cookies or authentication
    allowRequestMethods: 'GET, POST, PUT, DELETE, OPTIONS, HEAD',
    allowRequestHeaders: 'content-type, Authorization',
    allowResponseHeaders: 'content-type, Authorization' // Updated from exposeHeaders
  },

  // CSRF (Cross-Site Request Forgery) protection
  csrf: false,

  // HTTP Strict Transport Security (HSTS) settings to force HTTPS on all requests
  hsts: {
    maxAge: 365 * 24 * 60 * 60, // One year in seconds
    includeSubDomains: true,    // Apply HSTS to all subdomains
    preload: true               // Opt-in to preload list for browsers (consider implications)
  },

  // Content Security Policy (CSP) - Define content sources which are allowed to be loaded
  csp: {
    useDefaults: true, // Use default CSP directives (good starting point)
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://trusted.cdn.com"],
      styleSrc: ["'self'", "https://trusted.cdn.com", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https://trusted.cdn.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      connectSrc: ["'self'", "wss://yourapp.com", "https://api.yourapp.com"],
      reportUri: '/report-violation', // Endpoint where CSP violation reports are POSTed
    }
  }
};