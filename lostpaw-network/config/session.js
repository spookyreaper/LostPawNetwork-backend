// config/session.js
module.exports.session = {
  cookie: {
    secure: true,
    httpOnly: true,
    sameSite: 'strict'
  },
};
