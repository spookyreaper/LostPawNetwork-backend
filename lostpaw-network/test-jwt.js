const crypto = require('crypto');

const secret = 'your-256-bit-secret';
const base64Secret = Buffer.from(secret).toString('base64');
console.log('Base64 Encoded Secret:', base64Secret);
