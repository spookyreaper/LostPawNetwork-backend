const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

module.exports = {
  register: async function(req, res) {
    try {
      const existingUser = await User.findOne({
        or: [
          { username: req.body.username },
          { email: req.body.email }
        ]
      });

      if (existingUser) {
        return res.status(409).json({ message: 'Username or email already exists' });
      }

      const hashedPassword = await bcrypt.hash(req.body.password, 10);

      const newUser = await User.create({ ...req.body, password: hashedPassword }).fetch();

      const token = jwt.sign({ userId: newUser.id }, process.env.JWT_SECRET, { expiresIn: '24h' });

      return res.status(201).json({ message: 'User registered successfully', user: newUser, token });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },

  login: async function(req, res) {
    try {
      const user = await User.findOne({ email: req.body.email });
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const passwordIsValid = await bcrypt.compare(req.body.password, user.password);

      if (!passwordIsValid) {
        return res.status(401).json({ message: 'Invalid password' });
      }

      const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '24h' });

      return res.status(200).json({ message: 'Login successful', token, userId: user.id });
    } catch (err) {
      return res.status(500).json({ message: 'Error logging in', error: err });
    }
  },

  logout: async function(req, res) {
    req.session.destroy((err) => {
      if (err) {
        return res.serverError(err);
      }
      return res.redirect('/');
    });
  },

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

  update: async function(req, res) {
    try {
      const updatedUser = await User.updateOne({ id: req.user.userId }).set(req.body);
      if (!updatedUser) {
        return res.status(404).json({ error: 'User not found' });
      }
      return res.json({ message: 'Profile updated successfully', user: updatedUser });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  },

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

  completeProfile: async function(req, res) {
    try {
      const user = await User.updateOne({ id: req.user.userId }).set({
        contactInfo: req.body.contactInfo
      });

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      return res.status(200).json({ message: 'Profile updated successfully', user });
    } catch (err) {
      return res.status(500).json({ message: 'Error updating profile', error: err.message });
    }
  },

  getProfile: async function(req, res) {
    try {
      const userId = req.params.id; // assuming you pass the user ID as a URL parameter
      const user = await User.findOne({ id: userId });

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const lostReports = await Report.find({ user: userId, status: 'lost' });
      const foundReports = await Report.find({ user: userId, status: 'found' });

      return res.status(200).json({
        user,
        lostReports,
        foundReports
      });
    } catch (err) {
      return res.status(500).json({ message: 'Error fetching profile', error: err });
    }
  },

  updateProfile: async function(req, res) {
    try {
      const userId = req.user.userId;
      const updatedUser = await User.updateOne({ id: userId }).set(req.body);
      if (!updatedUser) {
        return res.status(404).json({ message: 'User not found' });
      }
      return res.json({ message: 'Profile updated successfully', user: updatedUser });
    } catch (err) {
      return res.status(500).json({ message: 'Error updating profile', error: err.message });
    }
  }
};
