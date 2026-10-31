const publicFields = ['id', 'username', 'email', 'contactInfo', 'accountCreated', 'createdAt', 'updatedAt'];

module.exports = {
  attributes: {
    id: {
      type: 'string',
      columnName: '_id',
      required: true,
      unique: true
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
    return publicFields.reduce((user, field) => {
      if (this[field] !== undefined) {
        user[field] = this[field];
      }
      return user;
    }, {});
  }
};
