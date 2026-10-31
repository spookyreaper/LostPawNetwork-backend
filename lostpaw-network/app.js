const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true });
const { initializeEnvironment } = require('./lib/runtime');

process.chdir(__dirname);

try {
  const runtime = initializeEnvironment();
  const sails = require('sails');
  const rc = require('sails/accessible/rc');
  sails.lift({ ...rc('sails'), port: runtime.port, explicitHost: runtime.host }, (error) => {
    if (error) {
      console.error('Unable to start Lost Paw Network. Check the database and server configuration.');
      process.exitCode = 1;
      return;
    }
    console.log(`Lost Paw Network API: http://${runtime.host}:${runtime.port}`);
  });
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
