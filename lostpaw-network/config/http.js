const express = require('express');

module.exports.http = {
  middleware: {
    order: [
      'cookieParser',
      'session',
      'bodyParser',
      'compress',
      'poweredBy',
      'router',
      'www', // Ensure this middleware is enabled
      'favicon',
    ],
    session: require('express-session')({ secret: 'aRandomStringHere', saveUninitialized: true, resave: false, cookie: { maxAge: 24 * 60 * 60 * 1000 } }),
    www: express.static(require('path').resolve(__dirname, '../assets')),
  }
};
