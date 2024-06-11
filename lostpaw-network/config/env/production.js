module.exports = {
  datastores: {
    default: {
      adapter: 'sails-mongo',
      url: process.env.MONGODB_URI,
    },
  },
  session: {
    secret: process.env.SESSION_SECRET,
    cookie: {
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      secure: true,
    },
  },
  custom: {
    baseUrl: 'https://lostpawnetwork-100c261cba8a.herokuapp.com/',
    internalEmailAddress: 'Brandon.alvarado9991@gmail.com',
  },
  log: {
    level: 'debug',
  },
  sockets: {
    onlyAllowOrigins: [
      'https://lostpawnetwork.netlify.app',
    ],
  },
  http: {
    trustProxy: true,
    cache: 365.25 * 24 * 60 * 60 * 1000, // One year
  },
  security: {
    cors: {
      allRoutes: true,
      allowOrigins: ['https://lostpawnetwork.netlify.app'],
      allowCredentials: true, // Allow credentials if using cookies or authentication
      allowRequestMethods: 'GET, POST, PUT, DELETE, OPTIONS, HEAD',
      allowRequestHeaders: 'content-type, Authorization',
      allowResponseHeaders: 'content-type, Authorization' // Updated from exposeHeaders
    },
    csrf: false, // CSRF (Cross-Site Request Forgery) protection
    hsts: {
      maxAge: 365 * 24 * 60 * 60, // One year in seconds
      includeSubDomains: true,    // Apply HSTS to all subdomains
      preload: true               // Opt-in to preload list for browsers (consider implications)
    },
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
  }
};
