module.exports = {
  // Session IDs carry 256 bits of randomness and are not MongoDB ObjectIds.
  dontUseObjectIds: true,
  attributes: {
    id: { type: 'string', columnName: '_id', required: true, unique: true, maxLength: 64 },
    userId: { type: 'string', required: true, maxLength: 150 },
    passwordFingerprint: { type: 'string', required: true, maxLength: 64 },
    expiresAt: { type: 'number', required: true },
  },
  customToJSON: function() {
    return {};
  },
};
