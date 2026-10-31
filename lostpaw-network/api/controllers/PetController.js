const { generateId } = require('../../lib/id');
const { uploadPetPhoto } = require('../../lib/uploads');
const validate = require('../../lib/report-validation');

function petValues(body, required) {
  const values = {};
  for (const field of ['name', 'breed', 'color']) {
    if (required || field in body) {
      values[field] = validate.text(body[field], field, 150);
    }
  }
  if (required || 'species' in body) { values.species = validate.species(body.species); }
  if (required || 'age' in body) { values.age = validate.age(body.age); }
  if (required || 'photoURL' in body) { values.photoURL = validate.photoURL(body.photoURL); }
  return values;
}

module.exports = {
  create: async function (req, res) {
    try {
      const user = validate.authenticatedUser(req);
      const values = petValues(validate.body(req.body), true);
      const pet = await Pet.create({ id: generateId(), ...values, user }).fetch();
      return res.status(201).json(validate.publicPet(pet));
    } catch (error) {
      return validate.handleError(res, error);
    }
  },

  find: async function (req, res) {
    try {
      const pets = await Pet.find().sort('createdAt DESC');
      return res.json(pets.map(validate.publicPet));
    } catch (error) {
      return validate.handleError(res, error);
    }
  },

  findOne: async function (req, res) {
    try {
      const pet = await Pet.findOne({ id: req.params.id });
      if (!pet) {
        throw validate.httpError(404, 'Pet not found');
      }
      return res.json(validate.publicPet(pet));
    } catch (error) {
      return validate.handleError(res, error);
    }
  },

  update: async function (req, res) {
    try {
      const user = validate.authenticatedUser(req);
      const existing = await Pet.findOne({ id: req.params.id });
      if (!existing) {
        throw validate.httpError(404, 'Pet not found');
      }
      if (!validate.isOwner(existing, user)) {
        throw validate.httpError(403, 'You are not authorized to update this pet');
      }
      const values = petValues(validate.body(req.body), false);
      if (Object.keys(values).length === 0) {
        throw validate.httpError(400, 'No editable pet fields were provided.');
      }
      const pet = await Pet.updateOne({ id: req.params.id, user }).set(values);
      if (!pet) {
        throw validate.httpError(404, 'Pet not found');
      }
      const reportValues = {};
      if (values.name) { reportValues.petName = values.name; }
      if (values.species) {
        reportValues.animalType = values.species;
        reportValues.category = values.species;
      }
      if (Object.keys(reportValues).length) {
        await Report.update({ pet: pet.id, user }).set(reportValues);
      }
      return res.json(validate.publicPet(pet));
    } catch (error) {
      return validate.handleError(res, error);
    }
  },

  destroy: async function (req, res) {
    try {
      const user = validate.authenticatedUser(req);
      const existing = await Pet.findOne({ id: req.params.id });
      if (!existing) {
        throw validate.httpError(404, 'Pet not found');
      }
      if (!validate.isOwner(existing, user)) {
        throw validate.httpError(403, 'You are not authorized to delete this pet');
      }
      if (await Report.count({ pet: req.params.id })) {
        throw validate.httpError(409, 'Remove this pet\'s reports before deleting the pet.');
      }
      const pet = await Pet.destroyOne({ id: req.params.id, user });
      if (!pet) {
        throw validate.httpError(404, 'Pet not found');
      }
      return res.status(204).send();
    } catch (error) {
      return validate.handleError(res, error);
    }
  },

  uploadPhoto: async function (req, res) {
    try {
      validate.authenticatedUser(req);
      const photo = req.uploadedPhoto || await uploadPetPhoto(req);
      return res.json({ message: 'File uploaded successfully!', url: photo.url, photoURL: photo.url });
    } catch (error) {
      return validate.handleError(res, error);
    }
  },
};
