const path = require('node:path');

function servePhoto(req, res) {
  const filename = req.params.filename;
  if (typeof filename !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9._-]*\.(?:jpe?g|png|gif|webp|avif)$/i.test(filename)) {
    return res.status(404).json({ error: 'Photo not found' });
  }
  const { getUploadDirectory } = require('../lib/uploads');
  const directories = [getUploadDirectory(), path.join(sails.config.appPath, 'assets/images/pets')];
  const send = (index) => res.sendFile(filename, {
    root: directories[index],
    dotfiles: 'deny',
    headers: { 'Cache-Control': 'public, max-age=86400', 'X-Content-Type-Options': 'nosniff' },
  }, (error) => {
    if (!error || res.headersSent) return;
    if (error.status === 404 || error.code === 'ENOENT') {
      if (index + 1 < directories.length) return send(index + 1);
      return res.status(404).json({ error: 'Photo not found' });
    }
    return res.status(500).json({ error: 'Unable to load this photo' });
  });
  return send(0);
}

module.exports.routes = {
  'GET /': function(req, res) { return res.json({ service: 'Lost Paw Network API', health: '/health' }); },
  'GET /health': function(req, res) { return res.json({ status: 'ok' }); },
  'POST /locations/search': 'LocationController.search',
  'POST /report': 'ReportController.create',
  'GET /report/:id': 'ReportController.findOne',
  'GET /reports': 'ReportController.find',
  'GET /reports/lost/all': 'ReportController.findAllLost',
  'GET /reports/lost/:category': 'ReportController.findLostByCategory',
  'GET /reports/found/all': 'ReportController.findAllFound',
  'GET /reports/found/:category': 'ReportController.findFoundByCategory',
  'PUT /report/:id': 'ReportController.update',
  'DELETE /report/:id': 'ReportController.destroy',
  'POST /user/register': 'UserController.register',
  'POST /user/login': 'UserController.login',
  'POST /user/logout': 'UserController.logout',
  'PUT /user/password': 'UserController.changePassword',
  'GET /user/profile/:id': 'UserController.getProfile',
  'POST /user/complete-profile': 'UserController.completeProfile',
  'GET /user/:id': 'UserController.findOne',
  'PUT /user/:id': 'UserController.update',
  'DELETE /user/:id': 'UserController.destroy',
  'POST /pet': 'PetController.create',
  'GET /pets': 'PetController.find',
  'GET /pet': 'PetController.find',
  'POST /pet/uploadPhoto': 'PetController.uploadPhoto',
  'GET /pet/:id': 'PetController.findOne',
  'PUT /pet/:id': 'PetController.update',
  'DELETE /pet/:id': 'PetController.destroy',
  'GET /images/pets/:filename': { fn: servePhoto, skipAssets: false },
};
