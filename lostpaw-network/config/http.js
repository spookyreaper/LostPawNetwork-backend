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
    www: express.static(require('path').resolve(__dirname, '../assets')),
  }
};
