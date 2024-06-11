module.exports.policies = {
  '*': 'isLoggedIn',  // Apply 'isLoggedIn' policy to all controllers by default

  UserController: {
    'register': true,  // Allow public access to register
    'login': true,     // Allow public access to login
    'logout': 'isLoggedIn',  // Only logged-in users can log out
    'findOne': 'isLoggedIn',  // Only logged-in users can view their profile
    'update': 'isLoggedIn',  // Only logged-in users can update their profile
    'destroy': 'isLoggedIn',  // Only logged-in users can delete their profile
    'completeProfile': 'isLoggedIn' // Only logged-in users can complete profile
  },

  ReportController: {
    'create': 'isLoggedIn',  // Only logged-in users can create reports
    'find': true,  // Public can view all reports
    'findOne': true,  // Public can view specific reports
    'findLostByCategory': true, // Public can view lost reports by category
    'findFoundByCategory': true, // Public can view found reports by category
  },

  PetController: {
    'create': 'isLoggedIn',  // Only logged-in users can create pets
    'find': true,  // Public can view all pets
    'findOne': true,  // Public can view specific pets
    'update': 'isLoggedIn',  // Only logged-in users can update pets
    'destroy': 'isLoggedIn',  // Only logged-in users can delete pets
    'uploadPhoto': 'isLoggedIn' // Only logged-in users can upload pet photos
  }
};
