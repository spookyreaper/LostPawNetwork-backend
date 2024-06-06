// api/models/Report.js
module.exports = {
  attributes: {
    _id: {
      type: 'string',
      columnName: '_id',
      unique: true,
    },
    type: {
      type: 'string',
      isIn: ['lost', 'found'],
      required: true
    },
    description: {
      type: 'string',
      required: true
    },
    location: {
      type: 'string',
      required: true
    },
    latitude: {
      type: 'number',
      allowNull: true
    },
    longitude: {
      type: 'number',
      allowNull: true
    },
    contactInfo: {
      type: 'string',
      required: true
    },
    photoUrls: {
      type: 'json',
      columnType: 'array',
      defaultsTo: []
    },
    user: {
      model: 'user'
    },
    pet: {
      model: 'pet'
    },
    status: {
      type: 'string',
      isIn: ['open', 'closed', 'reunited'],
      defaultsTo: 'open'
    },
    comments: {
      type: 'string',
      allowNull: true
    }
  }
};
