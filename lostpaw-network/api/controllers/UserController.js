module.exports = {
    create: async function (req, res) {
      try {
        const newUser = await User.create(req.body).fetch();
        return res.status(201).json(newUser);
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    },
  
    findOne: async function (req, res) {
      try {
        const user = await User.findOne({ id: req.params.id });
        if (!user) {
          return res.status(404).json({ error: 'No user found with the specified ID' });
        }
        return res.status(200).json(user);
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    },
  
    update: async function (req, res) {
      try {
        const updatedUser = await User.updateOne({ id: req.params.id }).set(req.body);
        if (!updatedUser) {
          return res.status(404).json({ error: 'No user found with the specified ID' });
        }
        return res.status(200).json(updatedUser);
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    },
  
    destroy: async function (req, res) {
      try {
        const deletedUser = await User.destroyOne({ id: req.params.id });
        if (!deletedUser) {
          return res.status(404).json({ error: 'No user found with the specified ID' });
        }
        return res.status(204).send();
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }
  };
  