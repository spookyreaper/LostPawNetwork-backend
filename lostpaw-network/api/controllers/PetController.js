module.exports = {
    create: async function (req, res) {
      try {
        const newPet = await Pet.create({ ...req.body, userId: req.body.userId }).fetch();
        return res.status(201).json(newPet);
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    },
  
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
  
    update: async function (req, res) {
      try {
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
    }
  };
  