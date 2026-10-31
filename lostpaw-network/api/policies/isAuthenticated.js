const { verifyToken, passwordFingerprint, MAX_TOKEN_LENGTH } = require('../../lib/auth-tokens');

module.exports = async function(req, res, next) {
  const header = req.headers && req.headers.authorization;
  const match = typeof header === 'string' && header.length <= MAX_TOKEN_LENGTH + 32 && /^Bearer\s+(\S+)$/i.exec(header.trim());
  if (!match) {
    return res.status(401).json({ message: 'An authorization token is required.' });
  }
  let decoded;
  try {
    decoded = verifyToken(match[1]);
  } catch (error) {
    if (error.code === 'E_AUTH_CONFIGURATION') {
      return res.status(503).json({ message: 'Authentication is temporarily unavailable.' });
    }
    return res.status(401).json({ message: 'Invalid or expired token.' });
  }
  try {
    const session = await AuthSession.findOne({ id: decoded.jti, userId: decoded.userId, expiresAt: { '>': Date.now() } });
    if (!session || session.deleted || session.id !== decoded.jti || session.userId !== decoded.userId || session.expiresAt !== decoded.exp * 1000) {
      return res.status(401).json({ message: 'Invalid or expired token.' });
    }
    const user = await User.findOne({ id: decoded.userId });
    if (!user || user.deleted || !session.passwordFingerprint || session.passwordFingerprint !== passwordFingerprint(user.password)) {
      return res.status(401).json({ message: 'Invalid or expired token.' });
    }
  } catch (unusedError) {
    return res.status(503).json({ message: 'Authentication is temporarily unavailable.' });
  }
  req.user = { userId: decoded.userId };
  req.auth = { sessionId: decoded.jti, expiresAt: decoded.exp * 1000 };
  return next();
};
