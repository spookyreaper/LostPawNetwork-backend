module.exports = {
  primaryKey: 'id',  // Set the primary key for the model here

  attributes: {
    id: {
      type: 'string',
      required: true,
      unique: true,
      columnName: '_id'
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
      allowNull: true
    },
    userId: {
      model: 'user',
      required: true
    }
  }
};
