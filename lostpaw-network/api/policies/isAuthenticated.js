const jwt = require('jsonwebtoken');

module.exports = async function(req, res, next) {
  if (!req.headers.authorization) {
    return res.status(401).json({ error: 'No authorization header found' });
  }

  const token = req.headers.authorization.split(' ')[1]; // Authorization: Bearer <token>
  try {
    const decoded = jwt.verify(token, 'your_jwt_secret');
    req.user = decoded; // Add user payload to request object
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};
