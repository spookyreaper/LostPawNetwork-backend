const jwt = require('jsonwebtoken');

module.exports = async function(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No authorization token provided' });
  }

  const token = authHeader.split(' ')[1];
  console.log('Verifying JWT with base64 secret:', process.env.JWT_SECRET_BASE64);
  try {
    const decoded = jwt.verify(token, Buffer.from(process.env.JWT_SECRET_BASE64, 'base64'));
    console.log('Decoded JWT:', decoded);
    req.user = decoded; // Add decoded user info to the request object
    next(); // Proceed to next middleware or controller action
  } catch (error) {
    console.error('JWT verification error:', error);
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};
