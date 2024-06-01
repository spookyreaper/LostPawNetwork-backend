module.exports.routes = {
  // Report routes
  'POST /report': { controller: 'ReportController', action: 'create', policy: 'isAuthenticated' },         // Create a new report
  'GET /report/:id': 'ReportController.findOne',     // Retrieve a specific report by ID (accessible to guests)
  'GET /reports': 'ReportController.find',           // Retrieve all reports (accessible to guests)
  'PUT /report/:id': { controller: 'ReportController', action: 'update', policy: 'isAuthenticated' },      // Update a specific report by ID
  'DELETE /report/:id': { controller: 'ReportController', action: 'destroy', policy: 'isAuthenticated' },  // Delete a specific report by ID

  // User routes
  'POST /user/register': 'UserController.register',  // Register a new user
  'POST /user/login': 'UserController.login',        // User login
  'GET /user/:id': { controller: 'UserController', action: 'findOne', policy: 'isAuthenticated' }, // Retrieve a specific user by ID
  'PUT /user/:id': { controller: 'UserController', action: 'update', policy: 'isAuthenticated' },  // Update a specific user by ID
  'DELETE /user/:id': { controller: 'UserController', action: 'destroy', policy: 'isAuthenticated' }, // Delete a specific user by ID

  // Pet routes 
  'POST /pet': { controller: 'PetController', action: 'create', policy: 'isAuthenticated' },
  'GET /pet/:id': { controller: 'PetController', action: 'findOne', policy: 'isAuthenticated' },
  'PUT /pet/:id': { controller: 'PetController', action: 'update', policy: 'isAuthenticated' },
  'DELETE /pet/:id': { controller: 'PetController', action: 'destroy', policy: 'isAuthenticated' },
  'POST /pet/uploadPhoto': { controller: 'PetController', action: 'uploadPhoto', policy: 'isAuthenticated' },
};
