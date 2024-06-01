// config/log.js
module.exports.log = {
  // Environment-specific logging levels
  level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',

  // Use custom transports in production for better performance
  custom: process.env.NODE_ENV === 'production' ? {
    transports: [
      new (require('winston').transports.File)({
        level: 'warn',
        filename: 'logs/error.log',
        maxsize: 1024 * 1024 * 10 // 10MB
      })
    ]
  } : undefined,

  // Setup for console logging in development
  inspect: process.env.NODE_ENV !== 'production'
};
