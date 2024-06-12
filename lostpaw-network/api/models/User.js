// Description: User model for the LostPaw Network API.
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
  }
};
