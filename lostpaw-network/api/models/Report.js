const { generateId } = require('../../lib/id');
const { publicReport } = require('../../lib/report-validation');

module.exports = {
  attributes: {
    id: { type: 'string', columnName: '_id', unique: true },
    status: { type: 'string', isIn: ['lost', 'found'], required: true },
    description: { type: 'string', required: true, maxLength: 5000 },
    petName: { type: 'string', maxLength: 150 },
    animalType: { type: 'string', isIn: ['cat', 'dog'] },
    location: { type: 'string', required: true },
    latitude: { type: 'number', allowNull: true, min: -90, max: 90 },
    longitude: { type: 'number', allowNull: true, min: -180, max: 180 },
    contactInfo: { type: 'string', required: true, maxLength: 300 },
    photoUrls: { type: 'json', defaultsTo: [] },
    user: { model: 'user', required: true },
    pet: { model: 'pet', required: true },
    category: { type: 'string', isIn: ['cat', 'dog'], required: true },
    comments: { type: 'string', allowNull: true, maxLength: 5000 },
  },
  beforeCreate: function (values, next) {
    values.id = values.id || generateId();
    return next();
  },
  customToJSON: function () {
    return publicReport(this);
  },
};
