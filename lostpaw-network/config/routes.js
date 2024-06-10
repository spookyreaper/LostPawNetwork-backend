module.exports.routes = {
  // Report routes
  'POST /report': { controller: 'ReportController', action: 'create', policy: 'isAuthenticated' },
  'GET /report/:id': 'ReportController.findOne',
  'GET /reports': 'ReportController.find',
  'GET /reports/lost/:category': 'ReportController.findLostByCategory',
  'PUT /report/:id': { controller: 'ReportController', action: 'update', policy: 'isAuthenticated' },
  'DELETE /report/:id': { controller: 'ReportController', action: 'destroy', policy: 'isAuthenticated' },

  // User routes
  'POST /user/register': 'UserController.register',
  'POST /user/login': 'UserController.login',
  'POST /user/logout': { controller: 'UserController', action: 'logout', policy: 'isLoggedIn' },
  'GET /user/:id': { controller: 'UserController', action: 'findOne', policy: 'isAuthenticated' },
  'GET /user/profile/:id': { controller: 'UserController', action: 'getProfile', policy: 'isAuthenticated' },
  'PUT /user/:id': { controller: 'UserController', action: 'update', policy: 'isAuthenticated' },
  'DELETE /user/:id': { controller: 'UserController', action: 'destroy', policy: 'isAuthenticated' },

  // Pet routes
  'POST /pet': { controller: 'PetController', action: 'create', policy: 'isAuthenticated' },
  'GET /pet/:id': { controller: 'PetController', action: 'findOne', policy: 'isAuthenticated' },
  'PUT /pet/:id': { controller: 'PetController', action: 'update', policy: 'isAuthenticated' },
  'DELETE /pet/:id': { controller: 'PetController', action: 'destroy', policy: 'isAuthenticated' },
  'POST /pet/uploadPhoto': { controller: 'PetController', action: 'uploadPhoto', policy: 'isAuthenticated' },

  // Complete profile route
  'POST /user/complete-profile': { controller: 'UserController', action: 'completeProfile' },
};
