const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

module.exports = {
  register: async function(req, res) {
    console.log('Register endpoint hit with data:', req.body);
    try {
      const existingUser = await User.findOne({
        or: [
          { username: req.body.username },
          { email: req.body.email }
        ]
      });

      if (existingUser) {
        console.log('User already exists with username or email:', existingUser);
        return res.status(409).json({ message: 'Username or email already exists' });
      }

      const hashedPassword = await bcrypt.hash(req.body.password, 10);
      console.log('Hashed password:', hashedPassword);

      const newUser = await User.create({ ...req.body, password: hashedPassword }).fetch();
      console.log('New user created:', newUser);

      req.session.user = { id: newUser.id };

      return res.status(201).json({ message: 'User registered successfully', user: newUser });
    } catch (err) {
      console.error('Error in register:', err);
      return res.status(500).json({ error: err.message });
    }
  },

  login: async function(req, res) {
    console.log('Login endpoint hit with data:', req.body);
    try {
      const user = await User.findOne({ email: req.body.email });
      if (!user) {
        console.log('User not found:', req.body.email);
        return res.status(404).json({ message: 'User not found' });
      }

      console.log('User found:', user);
      const passwordIsValid = await bcrypt.compare(req.body.password, user.password);
      console.log('Password validation result:', passwordIsValid);

      if (!passwordIsValid) {
        return res.status(401).json({ message: 'Invalid password' });
      }

      console.log('Signing JWT with secret:', process.env.JWT_SECRET);
      const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '24h' });
      console.log('Issued Token:', token);
      return res.status(200).json({ message: 'Login successful', token, userId: user.id });
    } catch (err) {
      console.error('Error in login:', err);
      return res.status(500).json({ message: 'Error logging in', error: err });
    }
  },

  findOne: async function(req, res) {
    console.log('findOne endpoint hit with id:', req.params.id);
    try {
      const user = await User.findOne({ id: req.params.id });
      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }
      console.log('Found user:', user);
      return res.json(user);
    } catch (err) {
      console.error('Error in findOne:', err);
      return res.status(500).json({ error: err.message });
    }
  },

  update: async function(req, res) {
    try {
      const updatedUser = await User.updateOne({ id: req.session.user.id }).set(req.body);
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
    console.log('Complete Profile endpoint hit with data:', req.session);
    try {
      const user = await User.updateOne({ id: req.session.user.id }).set({
        contactInfo: req.body.contactInfo
      });

      if (!user) {
        console.log('User not found for complete profile:', req.session.user.id);
        return res.status(404).json({ message: 'User not found' });
      }
      console.log('User profile updated:', user);

      return res.status(200).json({ message: 'Profile updated successfully', user });
    } catch (err) {
      console.error('Error in completeProfile:', err);
      return res.status(500).json({ message: 'Error updating profile', error: err });
    }
  },

  getProfile: async function(req, res) {
    console.log('getProfile endpoint hit with id:', req.params.id);
    try {
      const userId = req.params.id; // assuming you pass the user ID as a URL parameter
      const user = await User.findOne({ id: userId });

      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      const lostReports = await Report.find({ user: userId, type: 'lost' });
      const foundReports = await Report.find({ user: userId, type: 'found' });

      return res.status(200).json({
        user,
        lostReports,
        foundReports
      });
    } catch (err) {
      console.error('Error fetching profile:', err);
      return res.status(500).json({ message: 'Error fetching profile', error: err });
    }
  },

  updateProfile: async function(req, res) {
    try {
      const userId = req.session.user.id;
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
