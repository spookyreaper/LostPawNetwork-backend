// api/models/User.js
const bcrypt = require('bcrypt');

module.exports = {
  attributes: {
    id: {
      type: 'string',
      columnName: '_id',
    },
    username: {
      type: 'string',
      required: true,
      unique: true,
      maxLength: 150
    },
    email: {
      type: 'string',
      required: true,
      unique: true,
      isEmail: true
    },
    password: {
      type: 'string',
      required: true
    },
    contactInfo: {
      type: 'string',
      allowNull: true
    },
    accountCreated: {
      type: 'ref',
      columnType: 'datetime',
      autoCreatedAt: true
    }
  },

  customToJSON: function() {
    return _.omit(this, ['password']);
  },

  beforeCreate: function (user, proceed) {
    if (user.password) {
      bcrypt.hash(user.password, 10, (err, hash) => {
        if (err) return proceed(err);
        user.password = hash;
        return proceed();
      });
    } else {
      return proceed();
    }
  },

  beforeUpdate: function (user, proceed) {
    if (user.password) {
      bcrypt.hash(user.password, 10, (err, hash) => {
        if (err) return proceed(err);
        user.password = hash;
        return proceed();
      });
    } else {
      return proceed();
    }
  }
};
