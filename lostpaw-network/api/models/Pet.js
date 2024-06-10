module.exports = {
  attributes: {
    id: {
      type: 'string',
      columnName: '_id',
      unique: true,
      required: true
    },
    name: {
      type: 'string',
      required: true
    },
    species: {
      type: 'string',
      required: true
    },
    breed: {
      type: 'string',
      required: true
    },
    color: {
      type: 'string',
      required: true
    },
    age: {
      type: 'number',
      required: true
    },
    photoURL: {
      type: 'string',
      required: true
    },
    user: {
      model: 'user',
      required: true
    }
  }
};
