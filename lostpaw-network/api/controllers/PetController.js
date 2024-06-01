module.exports = {
    // Create a new pet record
    create: async function (req, res) {
      try {
        const newPet = await Pet.create({ ...req.body, userId: req.body.userId }).fetch();
        return res.status(201).json(newPet);
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    },
  
    // Retrieve a single pet record by ID
    findOne: async function (req, res) {
      try {
        const pet = await Pet.findOne({ id: req.params.id }).populate('userId');
        if (!pet) {
          return res.status(404).json({ error: 'No pet found with the specified ID' });
        }
        return res.status(200).json(pet);
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    },
  
    // Update a pet record by ID
    update: async function (req, res) {
      try {
        if (req.body.userId) {
          delete req.body.userId;  // Ensure the userId cannot be updated
        }
        const updatedPet = await Pet.updateOne({ id: req.params.id }).set(req.body);
        if (!updatedPet) {
          return res.status(404).json({ error: 'No pet found with the specified ID' });
        }
        return res.status(200).json(updatedPet);
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    },
  
    // Delete a pet record by ID
    destroy: async function (req, res) {
      try {
        const deletedPet = await Pet.destroyOne({ id: req.params.id });
        if (!deletedPet) {
          return res.status(404).json({ error: 'No pet found with the specified ID' });
        }
        return res.status(204).send();
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    },
  
    // Upload a photo associated with a pet
    uploadPhoto: async function (req, res) {
      req.file('petPhoto').upload({
        maxBytes: 10000000,  // Set the maximum file size to 10MB
        dirname: require('path').resolve(sails.config.appPath, 'assets/images/pets')
      }, async function whenDone(err, uploadedFiles) {
        if (err) {
          return res.serverError(err);
        }
        if (uploadedFiles.length === 0) {
          return res.badRequest('No file was uploaded');
        }
  
        const uploadedFile = uploadedFiles[0];
        const fullPath = uploadedFile.fd;
  
        try {
          const petId = req.body.petId;  // Assuming pet ID is sent along with the file
          if (!petId) {
            return res.badRequest('Pet ID is required.');
          }
          
          const updatedPet = await Pet.updateOne({ id: petId }).set({
            photoPath: fullPath  // Update the pet record with the path of the uploaded photo
          });
  
          if (!updatedPet) {
            return res.status(404).json({ error: 'No pet found with the specified ID' });
          }
  
          return res.ok({
            message: 'Photo uploaded successfully!',
            filePath: fullPath,
            pet: updatedPet
          });
        } catch (updateError) {
          return res.serverError(updateError);
        }
      });
    }
  };
  