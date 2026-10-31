const { generateId } = require('../../lib/id');

module.exports = {
  attributes: {
    id: { type: 'string', columnName: '_id', unique: true },
    content: { type: 'string', required: true, maxLength: 5000 },
  },
  beforeCreate: function (values, next) {
    values.id = values.id || generateId();
    return next();
  },
};
