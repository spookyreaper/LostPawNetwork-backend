const path = require('node:path');
require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true });
const { initializeEnvironment, getDatastoreConfig } = require('./lib/runtime');
const { generateId } = require('./lib/id');

async function seed() {
  if (process.env.NODE_ENV === 'production' || getDatastoreConfig().adapter !== 'sails-disk') {
    throw new Error('Demo seeding is allowed only with the local development disk database.');
  }
  initializeEnvironment();
  const sails = new (require('sails').Sails)();
  await new Promise((resolve, reject) => sails.load({ appPath: __dirname, hooks: { grunt: false, sockets: false, session: false, views: false }, log: { level: 'warn' } }, (error) => error ? reject(error) : resolve()));
  try {
    const bcrypt = require('bcrypt');
    const User = sails.models.user;
    const Pet = sails.models.pet;
    const Report = sails.models.report;
    let user = await User.findOne({ email: 'demo@example.test' });
    if (!user) {
      user = await User.create({ id: generateId(), username: 'Local Demo', email: 'demo@example.test', password: await bcrypt.hash('LostPaw-local-2026!', 12), contactInfo: 'Local demo account' }).fetch();
    }
    const examples = [
      { name: 'Milo', species: 'cat', status: 'lost', breed: 'Tabby', color: 'Gray', photo: '05114e67-0a5f-475d-af08-c17c7f5f22ff.jpeg', lat: 40.7128, lng: -74.006 },
      { name: 'Buddy', species: 'cat', status: 'found', breed: 'Domestic shorthair', color: 'Gray and white', photo: '149c289a-235f-437e-bc5a-7ae3f1be0a42.jpeg', lat: 40.73, lng: -74.01 },
    ];
    for (const example of examples) {
      const description = `Local demo report: ${example.name}. This is sample data for development.`;
      if (await Report.findOne({ user: user.id, description })) continue;
      const photoURL = `/images/pets/${example.photo}`;
      const pet = await Pet.create({ id: generateId(), name: example.name, species: example.species, breed: example.breed, color: example.color, age: 2, photoURL, user: user.id }).fetch();
      await Report.create({ id: generateId(), petName: example.name, animalType: example.species, status: example.status, category: example.species, description, location: JSON.stringify({ lat: example.lat, lng: example.lng }), latitude: example.lat, longitude: example.lng, contactInfo: 'Local demo account', photoUrls: [photoURL], user: user.id, pet: pet.id }).fetch();
    }
    console.log('Local demo reports are ready. Demo sign-in details are documented in README.md.');
  } finally {
    await new Promise((resolve, reject) => sails.lower((error) => error ? reject(error) : resolve()));
  }
}

seed().catch((error) => {
  console.error(error.code ? `Demo seeding failed (${error.code}).` : error.message);
  process.exitCode = 1;
});
