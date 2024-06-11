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
    onlyAllowOrigins: ["https://lostpawnetwork-100c261cba8a.herokuapp.com/"],
  },
  log: {
    level: 'debug',
  },
  http: {
    trustProxy: true,
  },
  security: {
    cors: {
      allRoutes: true,
      allowOrigins: ['https://lostpawnetwork.netlify.app/'],
      allowCredentials: true,
      allowRequestMethods: 'GET, POST, PUT, DELETE, OPTIONS, HEAD',
      allowRequestHeaders: 'content-type, Authorization',
      allowResponseHeaders: 'content-type, Authorization',
    },
    csrf: false,
  },
};
