const path = require('path');
const { ObjectId } = require('mongodb');

const ReportController = {
  // Create a new report
  create: async function (req, res) {
    try {
      // Extract data from the request body
      const { petName, description, location, contactInfo, animalType, breed, color, age, status, category } = req.body;

      if (!status || !['lost', 'found'].includes(status)) {
        return res.badRequest('Invalid or missing status.');
      }

      if (!category) {
        return res.badRequest('Missing category.');
      }

      if (!breed) {
        return res.badRequest('Missing breed.');
      }

      if (!color) {
        return res.badRequest('Missing color.');
      }

      if (!age) {
        return res.badRequest('Missing age.');
      }

      // Parse the location string back into an object
      const locationObj = JSON.parse(location);

      // Get userId from the authenticated user
      const userId = req.user.userId;

      // Upload the photo first
      req.file('petPhoto').upload({
        maxBytes: 10000000,
        dirname: path.resolve(sails.config.appPath, 'assets/images/pets')
      }, async function whenDone(err, uploadedFiles) {
        if (err) {
          return res.serverError(err);
        }
        if (uploadedFiles.length === 0) {
          return res.badRequest('No file was uploaded');
        }

        const photoUrl = path.basename(uploadedFiles[0].fd);

        // Create a new pet (for simplicity, assuming each report corresponds to a new pet)
        const newPet = await Pet.create({
          id: new ObjectId().toString(),
          name: petName,
          species: animalType,
          breed,
          color,
          age,
          photoURL: `/images/pets/${photoUrl}`,
          user: userId
        }).fetch();

        // Create the report with the uploaded photo URL and other data
        const newReport = await Report.create({
          id: new ObjectId().toString(), // Ensure the id is generated
          petName,
          description,
          location: JSON.stringify(locationObj), // Store location as string
          latitude: locationObj.lat,
          longitude: locationObj.lng,
          contactInfo,
          animalType,
          status, // Ensure status is passed correctly
          category,
          photoUrls: [`/images/pets/${photoUrl}`],
          user: userId, // Include userId
          pet: newPet.id // Associate the pet with the report
        }).fetch();

        return res.status(201).json({ message: 'Report created successfully', report: newReport });
      });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },

  // Retrieve a specific report by ID
  findOne: async function (req, res) {
    try {
      const report = await Report.findOne({ id: req.params.id }).populate('pet').populate('user');
      if (!report) {
        return res.status(404).json({ error: 'Report not found' });
      }
      return res.json(report);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },

  // Retrieve all reports
  find: async function (req, res) {
    try {
      const reports = await Report.find().populate('pet').populate('user');
      return res.json(reports);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },

  // Retrieve all lost reports
  findAllLost: async function (req, res) {
    try {
      const lostReports = await Report.find({ status: 'lost' }).populate('pet');
      return res.json(lostReports);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },

  // Retrieve all found reports
  findAllFound: async function (req, res) {
    try {
      const foundReports = await Report.find({ status: 'found' }).populate('pet');
      return res.json(foundReports);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },

  // Retrieve lost reports by category
  findLostByCategory: async function (req, res) {
    const { category } = req.params;
    try {
      const lostReports = await Report.find({ status: 'lost', category }).populate('pet');
      return res.json(lostReports);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },

  // Retrieve found reports by category
  findFoundByCategory: async function (req, res) {
    const { category } = req.params;
    try {
      const foundReports = await Report.find({ status: 'found', category }).populate('pet');
      return res.json(foundReports);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },

  // Update a report by ID
  update: async function (req, res) {
    try {
      const updatedReport = await Report.updateOne({ id: req.params.id }).set(req.body);
      if (!updatedReport) {
        return res.status(404).json({ error: 'Report not found' });
      }
      return res.json({ message: 'Report updated successfully', report: updatedReport });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },

  // Delete a report by ID
  destroy: async function (req, res) {
    try {
      const deletedReport = await Report.destroyOne({ id: req.params.id });
      if (!deletedReport) {
        return res.status(404).json({ error: 'Report not found' });
      }
      return res.status(204).send();
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }
};

module.exports = ReportController;
