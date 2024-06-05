const sails = require('sails');
const bcrypt = require('bcrypt');

async function seedData() {
  try {
    const passwordHash = await bcrypt.hash('password123', 10);  // Example password

    const users = await User.createEach([
      { username: 'john_doe', email: 'john@example.com', password: passwordHash, contactInfo: '123-456-7890' },
      { username: 'jane_doe', email: 'jane@example.com', password: passwordHash, contactInfo: '987-654-3210' }
    ]).fetch();

    if (users.length === 0) {
      throw new Error('No users were created.');
    }

    console.log('Seeded Users:', users);

    const reports = await Report.createEach([
      { type: 'lost', description: 'Lost gray cat.', location: 'Central Park', contactInfo: users[0].contactInfo, user: users[0].id },
      { type: 'found', description: 'Found black dog.', location: 'Downtown', contactInfo: users[1].contactInfo, user: users[1].id }
    ]).fetch();

    if (reports.length === 0) {
      throw new Error('No reports were created.');
    }

    console.log('Seeded Reports:', reports);
  } catch (err) {
    console.error('Error during seeding:', err);
    throw err;  // Rethrow or handle error appropriately
  }
}

sails.lift({}, async function(err) {
  if (err) {
    console.error('Error lifting sails:', err);
    return;
  }

  try {
    await seedData();
  } catch (err) {
    console.error('Seeding failed:', err);
  } finally {
    sails.lower(() => {
      console.log('Sails app lowered successfully.');
    });
  }
});
