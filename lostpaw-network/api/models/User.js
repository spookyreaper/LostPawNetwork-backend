const bcrypt = require('bcrypt');

module.exports = {
  attributes: {
    // Basic user attributes
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
      isEmail: true // Ensures the email is valid
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

    // Model methods
    toJSON: function() {
      var obj = this.toObject();
      delete obj.password; // Remove password from API responses
      return obj;
    }
  },

  // Lifecycle Callbacks
  beforeCreate: async function (user, proceed) {
    if (user.password) {
      const saltRounds = 10; // The cost of processing the data through bcrypt
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
