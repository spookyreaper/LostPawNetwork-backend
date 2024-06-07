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

      // Set user session
      req.session.user = { id: newUser.id };

      return res.status(201).json({ message: 'User registered successfully', user: newUser });
    } catch (err) {
      console.error('Error in register:', err);
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
      return res.status(200).json({ message: 'Login successful', token });
    } catch (err) {
      return res.status(500).json({ message: 'Error logging in', error: err });
    }
  },
  

  logout: async function(req, res) {
    try {
      req.session.user = null;
      return res.json({ message: 'Logout successful' });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
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
  }
};
