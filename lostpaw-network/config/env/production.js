require('dotenv').config();

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
    internalEmailAddress: 'support@example.com',
  },
  log: {
    level: 'debug',
  },
  sockets: {
    onlyAllowOrigins: [
      'https://lostpawnetwork.netlify.app/',
    ],
  },
  http: {
    trustProxy: true,
    cache: 365.25 * 24 * 60 * 60 * 1000, // One year
  },
};
