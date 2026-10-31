const bcrypt = require('bcrypt');
const { generateId } = require('../../lib/id');
const { BCRYPT_ROUNDS, validatePassword, passwordMatches } = require('../../lib/passwords');
const { issueToken, revokeSession, revokeUserSessions } = require('../../lib/auth-tokens');
const { replacePassword } = require('../../lib/replace-password');
const serializeUser = require('../models/User').customToJSON;

const hasOwn = (value, key) => Object.prototype.hasOwnProperty.call(value, key);

function invalid(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}

function bodyFor(req) {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    throw invalid('A JSON object is required.');
  }
  return req.body;
}

function usernameFor(value) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > 150) {
    throw invalid('Username must contain between 1 and 150 characters.');
  }
  return value.trim();
}

function emailFor(value) {
  if (typeof value !== 'string' || value.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) {
    throw invalid('Enter a valid email address.');
  }
  return value.trim().toLowerCase();
}

function passwordFor(value, isNew = false) {
  const error = validatePassword(value, { isNew });
  if (error) throw invalid(error);
  return value;
}

function contactFor(value, required) {
  if (value === null && !required) {
    return null;
  }
  if (typeof value !== 'string' || (required && !value.trim())) {
    throw invalid('Enter valid contact information.');
  }
  return value.trim();
}

function profileFields(body) {
  const values = {};
  if (hasOwn(body, 'username')) {
    values.username = usernameFor(body.username);
  }
  if (hasOwn(body, 'email')) {
    values.email = emailFor(body.email);
  }
  if (hasOwn(body, 'contactInfo')) {
    values.contactInfo = contactFor(body.contactInfo, false);
  }
  if (!Object.keys(values).length) {
    throw invalid('Provide a username, email, or contact information to update.');
  }
  return values;
}

function userIdFor(req) {
  return req.user && typeof req.user.userId === 'string' && req.user.userId.trim() ? req.user.userId : null;
}

function profileIdFor(req) {
  const id = req.params && req.params.id;
  if (typeof id !== 'string' || !id.trim() || id.length > 150) {
    throw invalid('A valid user ID is required.');
  }
  return id;
}

function publicUser(user, viewerId = user.id) {
  const values = serializeUser.call(user);
  if (viewerId !== user.id) {
    delete values.email;
    delete values.contactInfo;
  }
  return values;
}

function failed(res, error, message) {
  if (error.status === 400) {
    return res.status(400).json({ message: error.message });
  }
  if (error.status === 503 || error.code === 'E_AUTH_CONFIGURATION') {
    return res.status(503).json({ message: 'Authentication is temporarily unavailable.' });
  }
  if (error.code === 'E_UNIQUE' || error.code === 11000) {
    return res.status(409).json({ message: 'Unable to save these account details.' });
  }
  if (['E_INVALID_NEW_RECORD', 'E_INVALID_VALUES_TO_SET', 'E_INVALID_CRITERIA'].includes(error.code)) {
    return res.status(400).json({ message: 'The supplied user information is invalid.' });
  }
  return res.status(500).json({ message });
}

async function updateProfile(req, res) {
  const userId = userIdFor(req);
  if (!userId) {
    return res.status(401).json({ message: 'An authorization token is required.' });
  }
  if (req.params && req.params.id !== undefined && req.params.id !== userId) {
    return res.status(403).json({ message: 'You can only change your own profile.' });
  }
  try {
    const body = bodyFor(req);
    const values = profileFields(body);
    if (values.email !== undefined) {
      const current = await User.findOne({ id: userId });
      if (!current || current.deleted) return res.status(401).json({ message: 'Invalid or expired token.' });
      if (values.email !== current.email) {
        if (!body.currentPassword) throw invalid('Enter your current password to change your email.');
        if (!(await passwordMatches(passwordFor(body.currentPassword), current.password))) {
          return res.status(401).json({ message: 'Unable to verify your current password.' });
        }
      }
    }
    const user = await User.updateOne({ id: userId }).set(values);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }
    return res.json({ message: 'Profile updated successfully', user: publicUser(user) });
  } catch (error) {
    return failed(res, error, 'Unable to update the profile.');
  }
}

module.exports = {
  register: async function(req, res) {
    try {
      const body = bodyFor(req);
      const username = usernameFor(body.username);
      const email = emailFor(body.email);
      const password = passwordFor(body.password, true);
      if (!process.env.JWT_SECRET) {
        return res.status(503).json({ message: 'Authentication is temporarily unavailable.' });
      }
      const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
      const existingUser = await User.findOne({ or: [{ username }, { email }] });
      if (existingUser) {
        return res.status(409).json({ message: 'Unable to create an account with these details.' });
      }
      const user = await User.create({ id: generateId(), username, email, password: hash }).fetch();
      const token = await issueToken(user.id, user.password);
      return res.status(201).json({ message: 'User registered successfully', user: publicUser(user), token });
    } catch (error) {
      return failed(res, error, 'Unable to register this account.');
    }
  },

  login: async function(req, res) {
    try {
      const body = bodyFor(req);
      const email = emailFor(body.email);
      const password = passwordFor(body.password);
      if (!process.env.JWT_SECRET) {
        return res.status(503).json({ message: 'Authentication is temporarily unavailable.' });
      }
      let user = await User.findOne({ email });
      const matches = await passwordMatches(password, user?.password);
      if (!user || user.deleted || !matches) {
        return res.status(401).json({ message: 'Invalid email or password.' });
      }
      if (bcrypt.getRounds(user.password) < BCRYPT_ROUNDS) {
        const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
        const updated = await replacePassword(user.id, user.password, hash);
        if (!updated) return res.status(401).json({ message: 'Invalid email or password.' });
        user = { ...user, password: hash };
      }
      const token = await issueToken(user.id, user.password);
      return res.json({ message: 'Login successful', token, userId: user.id });
    } catch (error) {
      return failed(res, error, 'Unable to log in.');
    }
  },

  logout: async function(req, res) {
    if (!userIdFor(req) || !req.auth?.sessionId) {
      return res.status(401).json({ message: 'An authorization token is required.' });
    }
    try {
      await revokeSession(req.auth.sessionId, userIdFor(req));
      return res.status(204).send();
    } catch {
      return res.status(503).json({ message: 'Unable to end this session. Please try again.' });
    }
  },

  changePassword: async function(req, res) {
    const userId = userIdFor(req);
    if (!userId) return res.status(401).json({ message: 'An authorization token is required.' });
    try {
      const body = bodyFor(req);
      const currentPassword = passwordFor(body.currentPassword);
      const newPassword = passwordFor(body.newPassword, true);
      if (currentPassword === newPassword) throw invalid('Choose a password different from your current password.');
      const user = await User.findOne({ id: userId });
      if (!user || user.deleted || !(await passwordMatches(currentPassword, user.password))) {
        return res.status(401).json({ message: 'Unable to verify your current password.' });
      }
      const password = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
      const saved = await replacePassword(userId, user.password, password);
      if (!saved) return res.status(409).json({ message: 'Your account changed. Log in and try again.' });
      await revokeUserSessions(userId);
      return res.json({ message: 'Password changed. Log in again on each device.' });
    } catch (error) {
      return failed(res, error, 'Unable to change your password.');
    }
  },

  findOne: async function(req, res) {
    if (!userIdFor(req)) {
      return res.status(401).json({ message: 'An authorization token is required.' });
    }
    try {
      const user = await User.findOne({ id: profileIdFor(req) });
      if (!user) {
        return res.status(404).json({ message: 'User not found.' });
      }
      return res.json(publicUser(user, userIdFor(req)));
    } catch (error) {
      return failed(res, error, 'Unable to retrieve this user.');
    }
  },

  update: updateProfile,
  updateProfile: function(req, res) {
    return updateProfile(req, res);
  },

  destroy: async function(req, res) {
    const userId = userIdFor(req);
    if (!userId) {
      return res.status(401).json({ message: 'An authorization token is required.' });
    }
    try {
      if (profileIdFor(req) !== userId) {
        return res.status(403).json({ message: 'You can only delete your own account.' });
      }
      const user = await User.findOne({ id: userId });
      if (!user || user.deleted) return res.status(401).json({ message: 'Invalid or expired token.' });
      const body = bodyFor(req);
      if (!(await passwordMatches(passwordFor(body.currentPassword), user.password))) {
        return res.status(401).json({ message: 'Unable to verify your current password.' });
      }
      const [reportCount, petCount] = await Promise.all([
        Report.count({ user: userId }),
        Pet.count({ user: userId })
      ]);
      if (reportCount > 0 || petCount > 0) {
        return res.status(409).json({ message: 'Remove your reports and pets before deleting your account.' });
      }
      const deletedUser = await User.destroyOne({ id: userId });
      if (!deletedUser) {
        return res.status(404).json({ message: 'User not found.' });
      }
      await revokeUserSessions(userId);
      return res.status(204).send();
    } catch (error) {
      return failed(res, error, 'Unable to delete this account.');
    }
  },

  completeProfile: async function(req, res) {
    const userId = userIdFor(req);
    if (!userId) {
      return res.status(401).json({ message: 'An authorization token is required.' });
    }
    try {
      const contactInfo = contactFor(bodyFor(req).contactInfo, true);
      const user = await User.updateOne({ id: userId }).set({ contactInfo });
      if (!user) {
        return res.status(404).json({ message: 'User not found.' });
      }
      return res.json({ message: 'Profile updated successfully', user: publicUser(user) });
    } catch (error) {
      return failed(res, error, 'Unable to complete this profile.');
    }
  },

  getProfile: async function(req, res) {
    if (!userIdFor(req)) {
      return res.status(401).json({ message: 'An authorization token is required.' });
    }
    try {
      const userId = profileIdFor(req);
      const user = await User.findOne({ id: userId });
      if (!user) {
        return res.status(404).json({ message: 'User not found.' });
      }
      const [lostReports, foundReports] = await Promise.all([
        Report.find({ user: userId, status: 'lost' }).populate('pet'),
        Report.find({ user: userId, status: 'found' }).populate('pet')
      ]);
      return res.json({ user: publicUser(user, userIdFor(req)), lostReports, foundReports });
    } catch (error) {
      return failed(res, error, 'Unable to retrieve this profile.');
    }
  }
};
