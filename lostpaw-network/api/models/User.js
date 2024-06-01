const bcrypt = require('bcrypt');
const _ = require('lodash');

module.exports = {
  attributes: {
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
    },
  },

  customToJSON: function() {
    return _.omit(this, ['password']);
  },

  beforeCreate: async function (user, proceed) {
    if (user.password) {
      const saltRounds = 10;
      user.password = await bcrypt.hash(user.password, saltRounds);
    }
    return proceed();
  },

  beforeUpdate: async function (user, proceed) {
    if (user.password) {
      const saltRounds = 10;
      user.password = await bcrypt.hash(user.password, saltRounds);
    }
    return proceed();
  }
};
