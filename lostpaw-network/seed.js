const sails = require('sails');
const bcrypt = require('bcrypt');
const { ObjectId } = require('mongodb');

async function seedData() {
  try {
    const passwordHash = await bcrypt.hash('password123', 10);

    const users = await User.createEach([
      { id: new ObjectId().toString(), username: 'john_doe', email: 'john@example.com', password: passwordHash, contactInfo: '123-456-7890' },
      { id: new ObjectId().toString(), username: 'jane_doe', email: 'jane@example.com', password: passwordHash, contactInfo: '987-654-3210' },
      { id: new ObjectId().toString(), username: 'alice', email: 'alice@example.com', password: passwordHash, contactInfo: '456-789-1234' },
      { id: new ObjectId().toString(), username: 'bob', email: 'bob@example.com', password: passwordHash, contactInfo: '789-123-4567' },
      { id: new ObjectId().toString(), username: 'charlie', email: 'charlie@example.com', password: passwordHash, contactInfo: '321-654-9870' },
      { id: new ObjectId().toString(), username: 'david', email: 'david@example.com', password: passwordHash, contactInfo: '654-987-3210' },
      { id: new ObjectId().toString(), username: 'eva', email: 'eva@example.com', password: passwordHash, contactInfo: '987-321-6540' },
      { id: new ObjectId().toString(), username: 'frank', email: 'frank@example.com', password: passwordHash, contactInfo: '321-987-6540' },
      { id: new ObjectId().toString(), username: 'grace', email: 'grace@example.com', password: passwordHash, contactInfo: '654-321-9870' },
      { id: new ObjectId().toString(), username: 'hannah', email: 'hannah@example.com', password: passwordHash, contactInfo: '789-654-3210' }
    ]).fetch();

    if (users.length === 0) {
      throw new Error('No users were created.');
    }

    console.log('Seeded Users:', users);

    const pets = await Pet.createEach([
      { id: new ObjectId().toString(), name: 'Whiskers', species: 'Cat', breed: 'Tabby', color: 'Gray', age: 2, photoURL: 'https://placekitten.com/200/300', user: users[0].id },
      { id: new ObjectId().toString(), name: 'Buddy', species: 'Dog', breed: 'Labrador', color: 'Black', age: 3, photoURL: 'https://placedog.net/400/300', user: users[1].id },
      { id: new ObjectId().toString(), name: 'Simba', species: 'Cat', breed: 'Siamese', color: 'Cream', age: 4, photoURL: 'https://placekitten.com/201/301', user: users[2].id },
      { id: new ObjectId().toString(), name: 'Max', species: 'Dog', breed: 'Beagle', color: 'Brown', age: 2, photoURL: 'https://placedog.net/401/301', user: users[3].id },
      { id: new ObjectId().toString(), name: 'Bella', species: 'Cat', breed: 'Maine Coon', color: 'Black', age: 5, photoURL: 'https://placekitten.com/202/302', user: users[4].id },
      { id: new ObjectId().toString(), name: 'Oscar', species: 'Cat', breed: 'Bengal', color: 'Orange', age: 3, photoURL: 'https://placekitten.com/203/303', user: users[5].id },
      { id: new ObjectId().toString(), name: 'Charlie', species: 'Dog', breed: 'Poodle', color: 'White', age: 4, photoURL: 'https://placedog.net/402/302', user: users[6].id },
      { id: new ObjectId().toString(), name: 'Luna', species: 'Cat', breed: 'Sphynx', color: 'Pink', age: 1, photoURL: 'https://placekitten.com/204/304', user: users[7].id },
      { id: new ObjectId().toString(), name: 'Rocky', species: 'Dog', breed: 'Bulldog', color: 'Gray', age: 3, photoURL: 'https://placedog.net/403/303', user: users[8].id },
      { id: new ObjectId().toString(), name: 'Milo', species: 'Cat', breed: 'Persian', color: 'White', age: 2, photoURL: 'https://placekitten.com/205/305', user: users[9].id }
    ]).fetch();

    if (pets.length === 0) {
      throw new Error('No pets were created.');
    }

    console.log('Seeded Pets:', pets);

    const reports = await Report.createEach([
      { id: new ObjectId().toString(), type: 'lost', category: 'cats', description: 'Lost gray cat.', location: 'Central Park', contactInfo: users[0].contactInfo, user: users[0].id, pet: pets[0].id },
      { id: new ObjectId().toString(), type: 'found', category: 'dogs', description: 'Found black dog.', location: 'Downtown', contactInfo: users[1].contactInfo, user: users[1].id, pet: pets[1].id },
      { id: new ObjectId().toString(), type: 'lost', category: 'cats', description: 'Lost cream Siamese cat.', location: 'Uptown', contactInfo: users[2].contactInfo, user: users[2].id, pet: pets[2].id },
      { id: new ObjectId().toString(), type: 'found', category: 'dogs', description: 'Found brown Beagle.', location: 'Midtown', contactInfo: users[3].contactInfo, user: users[3].id, pet: pets[3].id },
      { id: new ObjectId().toString(), type: 'lost', category: 'cats', description: 'Lost black Maine Coon cat.', location: 'Downtown', contactInfo: users[4].contactInfo, user: users[4].id, pet: pets[4].id },
      { id: new ObjectId().toString(), type: 'lost', category: 'cats', description: 'Lost orange Bengal cat.', location: 'Brooklyn', contactInfo: users[5].contactInfo, user: users[5].id, pet: pets[5].id },
      { id: new ObjectId().toString(), type: 'found', category: 'dogs', description: 'Found white Poodle.', location: 'Queens', contactInfo: users[6].contactInfo, user: users[6].id, pet: pets[6].id },
      { id: new ObjectId().toString(), type: 'lost', category: 'cats', description: 'Lost pink Sphynx cat.', location: 'Bronx', contactInfo: users[7].contactInfo, user: users[7].id, pet: pets[7].id },
      { id: new ObjectId().toString(), type: 'found', category: 'dogs', description: 'Found gray Bulldog.', location: 'Harlem', contactInfo: users[8].contactInfo, user: users[8].id, pet: pets[8].id },
      { id: new ObjectId().toString(), type: 'lost', category: 'cats', description: 'Lost white Persian cat.', location: 'Staten Island', contactInfo: users[9].contactInfo, user: users[9].id, pet: pets[9].id }
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
