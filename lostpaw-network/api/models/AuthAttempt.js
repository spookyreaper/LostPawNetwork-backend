// Internal, expiring authentication counters. No password, email, or IP is stored.
module.exports = {
  dontUseObjectIds: true,
  attributes: {
    id: { type: 'string', columnName: '_id', required: true, unique: true },
    bucket: { type: 'string', required: true },
    expiresAt: { type: 'number', required: true },
  },
};
