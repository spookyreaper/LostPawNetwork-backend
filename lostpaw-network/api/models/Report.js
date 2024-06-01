module.exports = {
  attributes: {
    // Type of report: 'lost' or 'found'
    type: {
      type: 'string',
      isIn: ['lost', 'found'],
      required: true
    },
    // Description of the pet
    description: {
      type: 'string',
      required: true
    },
    // Location where the pet was lost or found
    location: {
      type: 'string',
      required: true
    },
    // Coordinates for the map (optional, can be added later with Google Maps API)
    latitude: {
      type: 'number'
    },
    longitude: {
      type: 'number'
    },
    // Contact information for the person reporting
    contactInfo: {
      type: 'string',
      required: true
    },
    // Photos of the pet (URLs to images)
    photoUrls: {
      type: 'json',
      columnType: 'array',
      defaultsTo: []
    },
    // Reference to User who reported (assuming you have a User model)
    user: {
      model: 'user'
    },
    // Status of the report (open, closed, reunited etc.)
    status: {
      type: 'string',
      isIn: ['open', 'closed', 'reunited'],
      defaultsTo: 'open'
    },
    // Additional comments
    comments: {
      type: 'string'
    }
  }
};
