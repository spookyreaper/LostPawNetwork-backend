const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

module.exports = {
  // Register a new user
  register: async function(req, res) {
    try {
      const hashedPassword = await bcrypt.hash(req.body.password, 10);
      const newUser = await User.create({ ...req.body, password: hashedPassword }).fetch();
      return res.status(201).json({ message: 'User registered successfully', user: newUser });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },

  // User login
  login: async function(req, res) {
    const user = await User.findOne({ email: req.body.email });
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    const match = await sails.helpers.passwords.checkPassword(req.body.password, user.password);
    if (!match) {
      return res.status(401).json({ error: 'Password is incorrect' });
    }

    // Set user id in session
    req.session.userId = user.id;
    return res.ok({ message: 'Login successful', user: user });
  },

  // Retrieve a specific user by ID
  findOne: async function(req, res) {
    try {
      const user = await User.findOne({ id: req.params.id });
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      return res.json(user);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },

  // Update user details
  update: async function(req, res) {
    try {
      const updatedUser = await User.updateOne({ id: req.session.userId }).set(req.body);
      if (!updatedUser) {
        return res.status(404).json({ error: 'User not found' });
      }
      return res.json({ message: 'Profile updated successfully', user: updatedUser });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },

  // Delete a user
  destroy: async function(req, res) {
    try {
      const deletedUser = await User.destroyOne({ id: req.params.id });
      if (!deletedUser) {
        return res.status(404).json({ error: 'User not found' });
      }
      return res.status(204).send();
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },
};
