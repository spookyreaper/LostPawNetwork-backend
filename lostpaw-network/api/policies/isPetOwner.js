const { authenticatedUser, isOwner, httpError, handleError } = require('../../lib/report-validation');

module.exports = async function (req, res, next) {
  try {
    const userId = authenticatedUser(req);
    const pet = await Pet.findOne({ id: req.params.id });
    if (!pet) {
      throw httpError(404, 'Pet not found');
    }
    if (!isOwner(pet, userId)) {
      throw httpError(403, 'You are not authorized to modify this pet');
    }
    req.pet = pet;
    return next();
  } catch (error) {
    return handleError(res, error);
  }
};
