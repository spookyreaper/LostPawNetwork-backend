// api/policies/isAuthenticated.js
const jwt = require('jsonwebtoken');

module.exports = async function(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No authorization token provided' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Attach the decoded user to the request object
    console.log('Authenticated user ID:', req.user.userId); // Log the authenticated user ID
    next(); // Proceed to next middleware or controller action
  } catch (error) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
};
