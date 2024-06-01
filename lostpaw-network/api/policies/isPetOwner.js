module.exports = async function(req, res, next) {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'You must be logged in to perform this action' });
    }
  
    const pet = await Pet.findOne({ id: req.params.id });
    if (!pet) {
      return res.status(404).json({ error: 'Pet not found' });
    }
  
    if (pet.user !== req.session.userId) {
      return res.status(403).json({ error: 'You are not authorized to update this pet' });
    }
  
    return next();
  };
  