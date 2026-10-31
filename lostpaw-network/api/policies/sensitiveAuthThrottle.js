const { createAuthThrottlePolicy } = require('../../lib/auth-throttle');

module.exports = createAuthThrottlePolicy('sensitive');
