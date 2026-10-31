const path = require('node:path');
module.exports.custom = {
  uploadDir: path.resolve(__dirname, '..', process.env.UPLOAD_DIR || '.data/uploads'),
};
