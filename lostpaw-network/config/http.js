require('dotenv').config();
const session = require('express-session');
const MongoStore = require('connect-mongo');
const express = require('express');
const path = require('path');

module.exports.http = {
  middleware: {
    order: [
      'cookieParser',
      'session',
      'bodyParser',
      'compress',
      'poweredBy',
      'router',
      'www',
      'favicon',
    ],
    session: session({
      secret: process.env.SESSION_SECRET,
      store: MongoStore.create({
        mongoUrl: process.env.MONGODB_URI,
        collectionName: 'sessions'
      }),
      saveUninitialized: false,
      resave: false,
      cookie: {
        maxAge: 24 * 60 * 60 * 1000, // 24 hours
        secure: process.env.NODE_ENV === 'production', // secure cookie for HTTPS, ensure your NODE_ENV is correctly set
        httpOnly: true,
        sameSite: 'lax'
      }
    }),
    www: express.static(path.resolve(__dirname, '../assets')),
  }
};
