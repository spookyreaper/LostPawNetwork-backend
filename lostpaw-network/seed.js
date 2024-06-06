const sails = require('sails');
const bcrypt = require('bcrypt');
const { ObjectId } = require('mongodb');

async function seedData() {
  try {
    const passwordHash = await bcrypt.hash('password123', 10);

    const users = await User.createEach([
      { id: new ObjectId().toString(), username: 'john_doe', email: 'john@example.com', password: passwordHash, contactInfo: '123-456-7890' },
      { id: new ObjectId().toString(), username: 'jane_doe', email: 'jane@example.com', password: passwordHash, contactInfo: '987-654-3210' }
    ]).fetch();

    if (users.length === 0) {
      throw new Error('No users were created.');
    }

    console.log('Seeded Users:', users);

    const pets = await Pet.createEach([
      { id: new ObjectId().toString(), name: 'Whiskers', species: 'Cat', breed: 'Tabby', color: 'Gray', age: 2, photoURL: 'https://placekitten.com/200/300', userId: users[0].id },
      { id: new ObjectId().toString(), name: 'Buddy', species: 'Dog', breed: 'Labrador', color: 'Black', age: 3, photoURL: 'https://placedog.net/400/300', userId: users[1].id }
    ]).fetch();

    if (pets.length === 0) {
      throw new Error('No pets were created.');
    }

    console.log('Seeded Pets:', pets);

    const reports = await Report.createEach([
      { id: new ObjectId().toString(), type: 'lost', description: 'Lost gray cat.', location: 'Central Park', contactInfo: users[0].contactInfo, user: users[0].id, pet: pets[0].id },
      { id: new ObjectId().toString(), type: 'found', description: 'Found black dog.', location: 'Downtown', contactInfo: users[1].contactInfo, user: users[1].id, pet: pets[1].id }
    ]).fetch();

    if (reports.length === 0) {
      throw new Error('No reports were created.');
    }

    console.log('Seeded Reports:', reports);
  } catch (err) {
    console.error('Error during seeding:', err);
    throw err;
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
