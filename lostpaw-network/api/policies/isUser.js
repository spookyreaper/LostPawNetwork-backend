module.exports = async function(req, res, next) {
    // Check if user is logged in
    if (!req.session.userId) {
      return res.status(401).json({ error: 'You must be logged in to perform this action' });
    }
  
    // Check if the user ID in the session matches the user ID for the update action
    if (req.params.id !== req.session.userId) {
      return res.status(403).json({ error: 'You can only update your own profile' });
    }
  
    return next();
  };
  