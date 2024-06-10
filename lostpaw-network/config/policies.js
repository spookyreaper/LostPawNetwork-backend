module.exports.policies = {
  '*': 'isAuthenticated',  // Apply 'isAuthenticated' policy to all controllers by default

  UserController: {
    'register': true,  // Allow public access to register
    'login': true,     // Allow public access to login
    'logout': 'isLoggedIn',  // Only logged-in users can log out
    'findOne': 'isAuthenticated',  // Only logged-in users can view their profile
    'update': 'isAuthenticated',  // Only logged-in users can update their profile
    'destroy': 'isAuthenticated',  // Only logged-in users can delete their profile
    'completeProfile': true // Allow public access to complete profile
  },

  ReportController: {
    'create': 'isAuthenticated',  // Only logged-in users can create reports
    'find': true,  // Public can view all reports
    'findOne': true,  // Public can view specific reports
    'findLostByCategory': 'isAuthenticated', // Ensure this route uses the isAuthenticated policy
    'findFoundByCategory': 'isAuthenticated', // Ensure this route uses the isAuthenticated policy
  },

  PetController: {
    'create': 'isAuthenticated',  // Only logged-in users can create pets
    'find': true,  // Public can view all pets
    'findOne': true,  // Public can view specific pets
    'update': 'isAuthenticated',  // Only logged-in users can update pets
    'destroy': 'isAuthenticated',  // Only logged-in users can delete pets
    'uploadPhoto': 'isAuthenticated' // Only logged-in users can upload pet photos
  }
};
