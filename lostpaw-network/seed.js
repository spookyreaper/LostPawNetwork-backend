require('dotenv').config();
const sails = require('sails');
const bcrypt = require('bcrypt');
const { ObjectId } = require('mongodb');

console.log('Session Secret:', process.env.SESSION_SECRET); // Check if the secret is being loaded
console.log('MongoDB URI:', process.env.MONGODB_URI); // Check if the MongoDB URI is being loaded

async function seedData() {
  try {
    const passwordHash = await bcrypt.hash('password123', 10);

    const existingUsers = await User.find({ email: { in: ['john@example.com', 'jane@example.com'] } });
    const existingUserEmails = existingUsers.map(user => user.email);

    const newUsers = [
      { id: new ObjectId().toString(), username: 'john_doe', email: 'john@example.com', password: passwordHash, contactInfo: '123-456-7890' },
      { id: new ObjectId().toString(), username: 'jane_doe', email: 'jane@example.com', password: passwordHash, contactInfo: '987-654-3210' }
    ].filter(user => !existingUserEmails.includes(user.email));

    const users = await User.createEach(newUsers).fetch();
    const allUsers = [...existingUsers, ...users];

    const pets = await Pet.createEach([
      { id: new ObjectId().toString(), name: 'Whiskers', species: 'Cat', breed: 'Tabby', color: 'Gray', age: 2, photoURL: 'https://placekitten.com/200/300', user: allUsers.find(user => user.email === 'john@example.com').id },
      { id: new ObjectId().toString(), name: 'Buddy', species: 'Dog', breed: 'Labrador', color: 'Black', age: 3, photoURL: 'https://placedog.net/400/300', user: allUsers.find(user => user.email === 'jane@example.com').id },
      { id: new ObjectId().toString(), name: 'Mittens', species: 'Cat', breed: 'Siamese', color: 'Cream', age: 3, photoURL: 'https://placekitten.com/300/300', user: allUsers.find(user => user.email === 'john@example.com').id },
      { id: new ObjectId().toString(), name: 'Spot', species: 'Dog', breed: 'Dalmatian', color: 'Spotted', age: 4, photoURL: 'https://placedog.net/500/300', user: allUsers.find(user => user.email === 'jane@example.com').id },
      { id: new ObjectId().toString(), name: 'Fluffy', species: 'Cat', breed: 'Persian', color: 'White', age: 4, photoURL: 'https://placekitten.com/400/300', user: allUsers.find(user => user.email === 'john@example.com').id },
      { id: new ObjectId().toString(), name: 'Rex', species: 'Dog', breed: 'German Shepherd', color: 'Brown', age: 5, photoURL: 'https://placedog.net/600/300', user: allUsers.find(user => user.email === 'jane@example.com').id }
    ]).fetch();

    const reports = await Report.createEach([
      // Lost reports
      { id: new ObjectId().toString(), status: 'lost', category: 'cats', description: 'Lost gray cat.', location: JSON.stringify({ lat: 40.785091, lng: -73.968285 }), latitude: 40.785091, longitude: -73.968285, contactInfo: allUsers.find(user => user.email === 'john@example.com').contactInfo, user: allUsers.find(user => user.email === 'john@example.com').id, pet: pets[0].id, photoUrls: ['https://placekitten.com/200/300'] },
      { id: new ObjectId().toString(), status: 'lost', category: 'dogs', description: 'Lost black Labrador.', location: JSON.stringify({ lat: 40.712776, lng: -74.005974 }), latitude: 40.712776, longitude: -74.005974, contactInfo: allUsers.find(user => user.email === 'jane@example.com').contactInfo, user: allUsers.find(user => user.email === 'jane@example.com').id, pet: pets[1].id, photoUrls: ['https://placedog.net/400/300'] },
      { id: new ObjectId().toString(), status: 'lost', category: 'cats', description: 'Lost Siamese cat.', location: JSON.stringify({ lat: 40.748817, lng: -73.985428 }), latitude: 40.748817, longitude: -73.985428, contactInfo: allUsers.find(user => user.email === 'john@example.com').contactInfo, user: allUsers.find(user => user.email === 'john@example.com').id, pet: pets[2].id, photoUrls: ['https://placekitten.com/300/300'] },
      { id: new ObjectId().toString(), status: 'lost', category: 'dogs', description: 'Lost Dalmatian.', location: JSON.stringify({ lat: 40.730610, lng: -73.935242 }), latitude: 40.730610, longitude: -73.935242, contactInfo: allUsers.find(user => user.email === 'jane@example.com').contactInfo, user: allUsers.find(user => user.email === 'jane@example.com').id, pet: pets[3].id, photoUrls: ['https://placedog.net/500/300'] },
      { id: new ObjectId().toString(), status: 'lost', category: 'cats', description: 'Lost white Persian cat.', location: JSON.stringify({ lat: 40.752998, lng: -73.977056 }), latitude: 40.752998, longitude: -73.977056, contactInfo: allUsers.find(user => user.email === 'john@example.com').contactInfo, user: allUsers.find(user => user.email === 'john@example.com').id, pet: pets[4].id, photoUrls: ['https://placekitten.com/400/300'] },
      { id: new ObjectId().toString(), status: 'lost', category: 'dogs', description: 'Lost German Shepherd.', location: JSON.stringify({ lat: 40.706192, lng: -74.008584 }), latitude: 40.706192, longitude: -74.008584, contactInfo: allUsers.find(user => user.email === 'jane@example.com').contactInfo, user: allUsers.find(user => user.email === 'jane@example.com').id, pet: pets[5].id, photoUrls: ['https://placedog.net/600/300'] },

      // Found reports
      { id: new ObjectId().toString(), status: 'found', category: 'cats', description: 'Found gray cat.', location: JSON.stringify({ lat: 40.785091, lng: -73.968285 }), latitude: 40.785091, longitude: -73.968285, contactInfo: allUsers.find(user => user.email === 'john@example.com').contactInfo, user: allUsers.find(user => user.email === 'john@example.com').id, pet: pets[0].id, photoUrls: ['https://placekitten.com/200/300'] },
      { id: new ObjectId().toString(), status: 'found', category: 'dogs', description: 'Found black Labrador.', location: JSON.stringify({ lat: 40.712776, lng: -74.005974 }), latitude: 40.712776, longitude: -74.005974, contactInfo: allUsers.find(user => user.email === 'jane@example.com').contactInfo, user: allUsers.find(user => user.email === 'jane@example.com').id, pet: pets[1].id, photoUrls: ['https://placedog.net/400/300'] },
      { id: new ObjectId().toString(), status: 'found', category: 'cats', description: 'Found Siamese cat.', location: JSON.stringify({ lat: 40.748817, lng: -73.985428 }), latitude: 40.748817, longitude: -73.985428, contactInfo: allUsers.find(user => user.email === 'john@example.com').contactInfo, user: allUsers.find(user => user.email === 'john@example.com').id, pet: pets[2].id, photoUrls: ['https://placekitten.com/300/300'] },
      { id: new ObjectId().toString(), status: 'found', category: 'dogs', description: 'Found Dalmatian.', location: JSON.stringify({ lat: 40.730610, lng: -73.935242 }), latitude: 40.730610, longitude: -73.935242, contactInfo: allUsers.find(user => user.email === 'jane@example.com').contactInfo, user: allUsers.find(user => user.email === 'jane@example.com').id, pet: pets[3].id, photoUrls: ['https://placedog.net/500/300'] },
      { id: new ObjectId().toString(), status: 'found', category: 'cats', description: 'Found white Persian cat.', location: JSON.stringify({ lat: 40.752998, lng: -73.977056 }), latitude: 40.752998, longitude: -73.977056, contactInfo: allUsers.find(user => user.email === 'john@example.com').contactInfo, user: allUsers.find(user => user.email === 'john@example.com').id, pet: pets[4].id, photoUrls: ['https://placekitten.com/400/300'] },
      { id: new ObjectId().toString(), status: 'found', category: 'dogs', description: 'Found German Shepherd.', location: JSON.stringify({ lat: 40.706192, lng: -74.008584 }), latitude: 40.706192, longitude: -74.008584, contactInfo: allUsers.find(user => user.email === 'jane@example.com').contactInfo, user: allUsers.find(user => user.email === 'jane@example.com').id, pet: pets[5].id, photoUrls: ['https://placedog.net/600/300'] }
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
