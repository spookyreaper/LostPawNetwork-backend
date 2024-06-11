const winston = require('winston');

const customLogger = process.env.NODE_ENV === 'production' ? winston.createLogger({
  level: 'warn',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'warn',
      maxsize: 1024 * 1024 * 10, // 10MB
    })
  ]
}) : undefined;

module.exports.log = {
  level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
  custom: customLogger,
  inspect: process.env.NODE_ENV !== 'production'
};
