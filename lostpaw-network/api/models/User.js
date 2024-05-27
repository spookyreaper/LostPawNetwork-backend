module.exports = {
  attributes: {
    userId: { type: 'string', required: true, unique: true, columnName: '_id' },
    username: { type: 'string', required: true },
    email: { type: 'string', required: true, isEmail: true },
    password: { type: 'string', required: true },
    contactInfo: { type: 'string', allowNull: true },
    accountCreated: { type: 'ref', columnType: 'datetime', required: true },
    // Relationships
    pets: {
      collection: 'pet',
      via: 'userId'
    },
    reports: {
      collection: 'report',
      via: 'userId'
    },
    messagesSent: {
      collection: 'message',
      via: 'senderUserId'
    },
    messagesReceived: {
      collection: 'message',
      via: 'receiverUserId'
    }
  }
};
