// This model represents a report of a lost or found pet.
module.exports = {
  attributes: {
    id: {
      type: 'string',
      columnName: '_id',
      unique: true,
      required: true
    },
    status: {
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
    category: {
      type: 'string',
      required: true
    },
    comments: {
      type: 'string',
      allowNull: true
    }
  }
};
