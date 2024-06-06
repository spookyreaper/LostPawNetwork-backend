module.exports = {
  create: async function (req, res) {
    try {
      const newPet = await Pet.create({ ...req.body, userId: req.body.userId }).fetch();
      return res.status(201).json(newPet);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },

  find: async function(req, res) {
    try {
      const reports = await Report.find().populate('pet');
      return res.json(reports);
    } catch (err) {
      return res.serverError(err);
    }
  },

  update: async function (req, res) {
    try {
      if (req.body.userId) {
        delete req.body.userId;
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

  uploadPhoto: function(req, res) {
    req.file('petPhoto').upload({
      dirname: require('path').resolve(sails.config.appPath, 'assets/images/pets')
    }, function (err, uploadedFiles) {
      if (err) return res.serverError(err);
      if (uploadedFiles.length === 0) return res.badRequest('No file was uploaded');
      
      const photoURL = '/images/pets/' + require('path').basename(uploadedFiles[0].fd);
      return res.json({ message: 'File uploaded successfully!', url: photoURL });
    });
  }
};
