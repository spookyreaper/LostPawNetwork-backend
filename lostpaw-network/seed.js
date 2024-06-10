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

    const pets = await Pet.createEach([
      { id: new ObjectId().toString(), name: 'Whiskers', species: 'Cat', breed: 'Tabby', color: 'Gray', age: 2, photoURL: 'https://placekitten.com/200/300', user: users[0].id },
      { id: new ObjectId().toString(), name: 'Buddy', species: 'Dog', breed: 'Labrador', color: 'Black', age: 3, photoURL: 'https://placedog.net/400/300', user: users[1].id },
      { id: new ObjectId().toString(), name: 'Rex', species: 'Dog', breed: 'German Shepherd', color: 'Brown', age: 4, photoURL: 'https://placedog.net/500/300', user: users[0].id },
      { id: new ObjectId().toString(), name: 'Bella', species: 'Dog', breed: 'Poodle', color: 'White', age: 2, photoURL: 'https://placedog.net/600/300', user: users[1].id },
      { id: new ObjectId().toString(), name: 'Charlie', species: 'Dog', breed: 'Beagle', color: 'Tri-color', age: 3, photoURL: 'https://placedog.net/700/300', user: users[0].id },
      { id: new ObjectId().toString(), name: 'Max', species: 'Dog', breed: 'Bulldog', color: 'Fawn', age: 2, photoURL: 'https://placedog.net/800/300', user: users[1].id }
    ]).fetch();

    const reports = await Report.createEach([
      { id: new ObjectId().toString(), type: 'lost', category: 'cats', description: 'Lost gray cat.', location: 'Central Park', contactInfo: users[0].contactInfo, user: users[0].id, pet: pets[0].id },
      { id: new ObjectId().toString(), type: 'lost', category: 'dogs', description: 'Lost black Labrador.', location: 'Downtown', contactInfo: users[1].contactInfo, user: users[1].id, pet: pets[1].id },
      { id: new ObjectId().toString(), type: 'lost', category: 'dogs', description: 'Lost German Shepherd.', location: 'Suburb', contactInfo: users[0].contactInfo, user: users[0].id, pet: pets[2].id },
      { id: new ObjectId().toString(), type: 'lost', category: 'dogs', description: 'Lost Poodle.', location: 'City Park', contactInfo: users[1].contactInfo, user: users[1].id, pet: pets[3].id },
      { id: new ObjectId().toString(), type: 'lost', category: 'dogs', description: 'Lost Beagle.', location: 'Town Center', contactInfo: users[0].contactInfo, user: users[0].id, pet: pets[4].id },
      { id: new ObjectId().toString(), type: 'lost', category: 'dogs', description: 'Lost Bulldog.', location: 'Eastside', contactInfo: users[1].contactInfo, user: users[1].id, pet: pets[5].id }
    ]).fetch();

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
