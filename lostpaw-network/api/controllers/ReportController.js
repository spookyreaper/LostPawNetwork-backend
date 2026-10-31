const { generateId } = require('../../lib/id');
const { uploadPetPhoto, removeUploadedPhoto } = require('../../lib/uploads');
const validate = require('../../lib/report-validation');

function categoryCriteria(value) {
  const category = validate.species(value);
  // Earlier seeds stored plural categories; canonical writes now use cat/dog.
  return { in: [category, `${category}s`] };
}

async function list(res, criteria) {
  const reports = await Report.find(criteria).populate('pet').sort('createdAt DESC');
  return res.json(reports.map(validate.publicReport));
}

module.exports = {
  create: async function (req, res) {
    let photo;
    let pet;
    try {
      const user = validate.authenticatedUser(req);
      const body = validate.body(req.body);
      const animalType = validate.species(body.animalType);
      if (body.category !== undefined && validate.species(body.category) !== animalType) {
        throw validate.httpError(400, 'Category must match the animal type.');
      }
      const values = {
        petName: validate.text(body.petName, 'Pet name', 150),
        description: validate.text(body.description, 'Description', 5000),
        contactInfo: validate.text(body.contactInfo, 'Contact info', 300),
        status: validate.status(body.status),
        animalType,
        category: animalType,
        ...validate.location(body.location),
      };
      const petValues = {
        name: values.petName, species: animalType,
        breed: validate.text(body.breed, 'Breed', 150),
        color: validate.text(body.color, 'Color', 150),
        age: validate.age(body.age),
      };
      photo = req.uploadedPhoto || await uploadPetPhoto(req);
      pet = await Pet.create({ id: generateId(), ...petValues, photoURL: photo.url, user }).fetch();
      const report = await Report.create({ id: generateId(), ...values, photoUrls: [photo.url], user, pet: pet.id }).fetch();
      return res.status(201).json({ message: 'Report created successfully', report: validate.publicReport(report) });
    } catch (error) {
      // Mongo deployments may not support transactions: compensate failed creation.
      const cleanup = await Promise.allSettled([
        pet ? Promise.resolve().then(() => Pet.destroyOne({ id: pet.id })) : Promise.resolve(),
        removeUploadedPhoto(photo),
      ]);
      for (const result of cleanup) {
        if (result.status === 'rejected') {
          sails.log.error(result.reason);
        }
      }
      return validate.handleError(res, error);
    }
  },

  findOne: async function (req, res) {
    try {
      const report = await Report.findOne({ id: req.params.id }).populate('pet');
      if (!report) {
        throw validate.httpError(404, 'Report not found');
      }
      return res.json(validate.publicReport(report));
    } catch (error) {
      return validate.handleError(res, error);
    }
  },

  find: async function (req, res) {
    try {
      return await list(res, {});
    } catch (error) {
      return validate.handleError(res, error);
    }
  },

  findAllLost: async function (req, res) {
    try {
      return await list(res, { status: 'lost' });
    } catch (error) {
      return validate.handleError(res, error);
    }
  },

  findAllFound: async function (req, res) {
    try {
      return await list(res, { status: 'found' });
    } catch (error) {
      return validate.handleError(res, error);
    }
  },

  findLostByCategory: async function (req, res) {
    try {
      return await list(res, { status: 'lost', category: categoryCriteria(req.params.category) });
    } catch (error) {
      return validate.handleError(res, error);
    }
  },

  findFoundByCategory: async function (req, res) {
    try {
      return await list(res, { status: 'found', category: categoryCriteria(req.params.category) });
    } catch (error) {
      return validate.handleError(res, error);
    }
  },

  update: async function (req, res) {
    try {
      const user = validate.authenticatedUser(req);
      const existing = await Report.findOne({ id: req.params.id });
      if (!existing) {
        throw validate.httpError(404, 'Report not found');
      }
      if (!validate.isOwner(existing, user)) {
        throw validate.httpError(403, 'You are not authorized to update this report');
      }
      const body = validate.body(req.body);
      const values = {};
      if ('description' in body) { values.description = validate.text(body.description, 'Description', 5000); }
      if ('contactInfo' in body) { values.contactInfo = validate.text(body.contactInfo, 'Contact info', 300); }
      if ('comments' in body) { values.comments = validate.text(body.comments, 'Comments', 5000, false); }
      if ('status' in body) { values.status = validate.status(body.status); }
      if ('location' in body) { Object.assign(values, validate.location(body.location)); }
      if (Object.keys(values).length === 0) {
        throw validate.httpError(400, 'No editable report fields were provided.');
      }
      const report = await Report.updateOne({ id: req.params.id, user }).set(values);
      if (!report) {
        throw validate.httpError(404, 'Report not found');
      }
      return res.json({ message: 'Report updated successfully', report: validate.publicReport(report) });
    } catch (error) {
      return validate.handleError(res, error);
    }
  },

  destroy: async function (req, res) {
    try {
      const user = validate.authenticatedUser(req);
      const existing = await Report.findOne({ id: req.params.id });
      if (!existing) {
        throw validate.httpError(404, 'Report not found');
      }
      if (!validate.isOwner(existing, user)) {
        throw validate.httpError(403, 'You are not authorized to delete this report');
      }
      const report = await Report.destroyOne({ id: req.params.id, user });
      if (!report) {
        throw validate.httpError(404, 'Report not found');
      }
      return res.status(204).send();
    } catch (error) {
      return validate.handleError(res, error);
    }
  },
};
