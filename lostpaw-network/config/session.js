module.exports.session = {
  secret: '4e5d6fc9d8bb24e1aaf0f8bdb1eb04c5',
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax'
  },
  maxAge: 24 * 60 * 60 * 1000,
  clearExpiredSessionsInterval: 24 * 60 * 60 * 1000
};
