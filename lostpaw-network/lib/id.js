const { randomBytes } = require('node:crypto');

module.exports.generateId = () => randomBytes(12).toString('hex');
