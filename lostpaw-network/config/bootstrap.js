require('dotenv').config();

module.exports.bootstrap = async function(done) {
  console.log('Environment variables loaded.');

  // Perform a simple database connectivity check
  try {
    await sails.getDatastore().leaseConnection(async (db) => {
      console.log('Database connection verified.');
      return db;  // This just ensures a connection can be established.
    });
  } catch (err) {
    console.error('Unable to connect to the database:', err);
    process.exit(1); // Exit the process if the database is not connected.
  }

  

  return done();
};
