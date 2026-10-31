module.exports = function(req, res, next) {
  if (!req.user || typeof req.user.userId !== 'string' || !req.user.userId) {
    return res.status(401).json({ message: 'An authorization token is required.' });
  }
  if (!req.params || req.params.id !== req.user.userId) {
    return res.status(403).json({ message: 'You can only change your own profile.' });
  }
  return next();
};
