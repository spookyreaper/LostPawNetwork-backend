// config/policies.js
module.exports.policies = {
  '*': 'isLoggedIn',  // Default policy for all controllers

  UserController: {
    'create': true,  // Allow anyone to register
    'login': true,   // Allow public login
    'logout': 'isLoggedIn'  // Only logged-in users can log out
  },

  ReportController: {
    '*': 'isLoggedIn',
    'create': 'isLoggedIn',  // Reinforce that creating a report requires login
    'find': true,  // Public can view all reports
    'findOne': true  // Public can view specific reports
  },

  PetController: {
    '*': 'isLoggedIn',
    'find': true,  // Allow public access to view pets
    'findOne': true  // Allow public access to view a specific pet
  }
};
