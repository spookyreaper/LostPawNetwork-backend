const session = require('express-session');
const MongoStore = require('connect-mongo');

module.exports.session = {
  secret: process.env.SESSION_SECRET || 'extremely-secure-keyboard-cat', // Fallback to a default secret if env variable is not set
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI,
    collectionName: 'sessions'
  }),
  cookie: {
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    secure: process.env.NODE_ENV === 'production', // Ensure cookies are only transmitted over HTTPS when in production
    httpOnly: true,
    sameSite: 'lax'
  },
  saveUninitialized: false,
  resave: false
};
