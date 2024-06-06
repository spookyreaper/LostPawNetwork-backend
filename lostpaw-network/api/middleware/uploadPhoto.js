const path = require('path');

module.exports = function uploadPhoto(req, res, next) {
  req.file('petPhoto').upload({
    // Set the maximum file size (e.g., 10 MB)
    maxBytes: 10000000,
    // Set the directory where files will be saved
    dirname: path.resolve(sails.config.appPath, 'assets/images/pets')
  }, function whenDone(err, uploadedFiles) {
    if (err) {
      return res.serverError(err);
    }
    if (uploadedFiles.length === 0) {
      return res.badRequest('No file was uploaded');
    }

    // Add the file path to the request object for further processing
    req.uploadedFilePath = uploadedFiles[0].fd;
    next();
  });
};
