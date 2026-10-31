const { uploadPetPhoto } = require('../../lib/uploads');
const { authenticatedUser, handleError } = require('../../lib/report-validation');

module.exports = async function uploadPhoto(req, res, next) {
  try {
    authenticatedUser(req);
    req.uploadedPhoto = await uploadPetPhoto(req);
    req.uploadedFilePath = req.uploadedPhoto.filePath;
    return next();
  } catch (error) {
    return handleError(res, error);
  }
};
