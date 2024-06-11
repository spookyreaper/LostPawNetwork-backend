module.exports = {
  datastores: {
    default: {
      adapter: 'sails-mongo',
      url: process.env.MONGODB_URI,
    },
  },

  session: {
    secret: process.env.SESSION_SECRET,
    adapter: 'connect-mongo',
    url: process.env.MONGODB_URI,
    collection: 'sessions',
    auto_reconnect: true,
    ssl: true,
    stringify: false,
    cookie: {
      secure: true,
      httpOnly: true,
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
  },

  sockets: {
    onlyAllowOrigins: [
      "https://lostpawnetwork-100c261cba8a.herokuapp.com",
      "http://localhost:5173",
      "https://lostpawnetwork.netlify.app"
    ],
    beforeConnect: function(handshake, proceed) {
      // Example function to check allowed origins
      if (this.onlyAllowOrigins.includes(handshake.headers.origin)) {
        return proceed(undefined, true);
      }
      return proceed(new Error('Not allowed by CORS'), false);
    }
  },

  log: {
    level: 'debug',
  },

  http: {
    trustProxy: true,  // Ensure that Sails can correctly see the protocol in Heroku
  },

  security: {
    cors: {
      allRoutes: true,
      allowOrigins: ['http://localhost:5173', 'https://lostpawnetwork.netlify.app'],
      allowCredentials: true,
      allowRequestMethods: 'GET, POST, PUT, DELETE, OPTIONS, HEAD',
      allowRequestHeaders: 'content-type, Authorization',
      allowResponseHeaders: 'content-type, Authorization',
    },
    csrf: false,
  },
};
