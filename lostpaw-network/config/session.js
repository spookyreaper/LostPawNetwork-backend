const session = require('express-session');
const MongoStore = require('connect-mongo')(session);

module.exports.session = {
  secret: process.env.SESSION_SECRET,
  adapter: 'connect-mongo',
  url: process.env.MONGODB_URI,
  collection: 'sessions',
  auto_reconnect: true,
  ssl: true,
  stringify: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
  store: new MongoStore({
    url: process.env.MONGODB_URI,
    ttl: 24 * 60 * 60 // 1 day
  })
};
