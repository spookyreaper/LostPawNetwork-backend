module.exports.routes = {
  // Report routes
  'POST /report': { controller: 'ReportController', action: 'create', policy: 'isLoggedIn' },
  'GET /report/:id': 'ReportController.findOne',
  'GET /reports': 'ReportController.find',
  'PUT /report/:id': { controller: 'ReportController', action: 'update', policy: 'isLoggedIn' },
  'DELETE /report/:id': { controller: 'ReportController', action: 'destroy', policy: 'isLoggedIn' },

  // User routes
  'POST /user/register': 'UserController.register',
  'POST /user/login': 'UserController.login',
  'POST /user/logout': { controller: 'UserController', action: 'logout', policy: 'isLoggedIn' },
  'GET /user/:id': { controller: 'UserController', action: 'findOne', policy: 'isLoggedIn' },
  'PUT /user/:id': { controller: 'UserController', action: 'update', policy: 'isLoggedIn' },
  'DELETE /user/:id': { controller: 'UserController', action: 'destroy', policy: 'isLoggedIn' },

  // Pet routes 
  'POST /pet': { controller: 'PetController', action: 'create', policy: 'isLoggedIn' },
  'GET /pet/:id': { controller: 'PetController', action: 'findOne', policy: 'isLoggedIn' },
  'PUT /pet/:id': { controller: 'PetController', action: 'update', policy: 'isLoggedIn' },
  'DELETE /pet/:id': { controller: 'PetController', action: 'destroy', policy: 'isLoggedIn' },
  'POST /pet/uploadPhoto': { controller: 'PetController', action: 'uploadPhoto', policy: 'isLoggedIn' },
};
