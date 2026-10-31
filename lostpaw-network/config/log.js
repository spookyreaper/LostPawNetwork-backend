// Container and local process logs go to stdout/stderr.
module.exports.log = { level: process.env.NODE_ENV === 'production' ? 'warn' : 'info' };
