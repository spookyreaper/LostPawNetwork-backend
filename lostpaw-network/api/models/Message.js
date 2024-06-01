// api/models/Message.js
module.exports = {
  attributes: {
    id: {
      type: 'string',
      columnName: '_id',
      unique: true,
      required: true
    },
    // Define other attributes of your message model here
    content: {
      type: 'string',
      required: true
    },
    // Add other necessary fields as per your application needs
  },

  primaryKey: 'id', // Indicate 'id' as the primary key at the top level
  dontUseObjectIds: true // Optional, set to true if you are not using MongoDB's ObjectId
};
