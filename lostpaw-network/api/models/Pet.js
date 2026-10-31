const { generateId } = require('../../lib/id');
const { publicPet } = require('../../lib/report-validation');

module.exports = {
  attributes: {
    id: { type: 'string', columnName: '_id', unique: true },
    name: { type: 'string', required: true, maxLength: 150 },
    species: { type: 'string', isIn: ['cat', 'dog'], required: true },
    breed: { type: 'string', required: true, maxLength: 150 },
    color: { type: 'string', required: true, maxLength: 150 },
    age: { type: 'number', required: true, min: 0 },
    photoURL: { type: 'string', required: true, maxLength: 200 },
    user: { model: 'user', required: true },
  },
  beforeCreate: function (values, next) {
    values.id = values.id || generateId();
    return next();
  },
  customToJSON: function () {
    return publicPet(this);
  },
};
