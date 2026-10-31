function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function body(value) {
  if (value === undefined) { return {}; }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw httpError(400, 'Request body must be an object.');
  }
  return value;
}

function text(value, field, maxLength, required = true) {
  if (typeof value !== 'string' || (required && !value.trim()) || value.length > maxLength) {
    throw httpError(400, `${field} must be ${required ? 'a nonempty' : 'a'} string of at most ${maxLength} characters.`);
  }
  return value.trim();
}

function species(value) {
  const normalized = typeof value === 'string' ? value.trim().toLowerCase().replace(/s$/, '') : '';
  if (!['cat', 'dog'].includes(normalized)) {
    throw httpError(400, 'Animal type must be cat or dog.');
  }
  return normalized;
}

function status(value) {
  if (!['lost', 'found'].includes(value)) {
    throw httpError(400, 'Status must be lost or found.');
  }
  return value;
}

function age(value) {
  if ((typeof value !== 'number' && typeof value !== 'string') || String(value).trim() === '' ||
      !Number.isFinite(Number(value)) || Number(value) < 0) {
    throw httpError(400, 'Age must be a nonnegative number.');
  }
  return Number(value);
}

function location(value) {
  let coordinates = value;
  if (typeof coordinates === 'string') {
    try {
      coordinates = JSON.parse(coordinates);
    } catch (unusedError) {
      throw httpError(400, 'Location must contain valid latitude and longitude.');
    }
  }
  if (!coordinates || typeof coordinates !== 'object' || Array.isArray(coordinates)) {
    throw httpError(400, 'Location must contain valid latitude and longitude.');
  }
  const valid = (number, max) => (typeof number === 'number' || typeof number === 'string') &&
    String(number).trim() !== '' && Number.isFinite(Number(number)) && Math.abs(Number(number)) <= max;
  if (!valid(coordinates.lat, 90) || !valid(coordinates.lng, 180)) {
    throw httpError(400, 'Location must contain valid latitude and longitude.');
  }
  const normalized = { lat: Number(coordinates.lat), lng: Number(coordinates.lng) };
  if (coordinates.label !== undefined) {
    const label = text(coordinates.label, 'Place name', 300, false);
    if (label) normalized.label = label;
  }
  return { location: JSON.stringify(normalized), latitude: normalized.lat, longitude: normalized.lng };
}

function photoURL(value) {
  if (typeof value !== 'string' || !/^\/images\/pets\/[a-zA-Z0-9_-]+\.(?:jpe?g|png|gif|webp|avif)$/.test(value) || value.length > 200) {
    throw httpError(400, 'Photo URL must refer to an uploaded pet image.');
  }
  return value;
}

function authenticatedUser(req) {
  const userId = req.user && req.user.userId;
  if (typeof userId !== 'string' || !userId.trim()) {
    throw httpError(401, 'You must be logged in to perform this action.');
  }
  return userId;
}

function isOwner(resource, userId) {
  const owner = resource && resource.user;
  return String(owner && typeof owner === 'object' ? owner.id : owner) === String(userId);
}

function handleError(res, error) {
  const statusCode = error.status || (['E_INVALID_NEW_RECORD', 'E_INVALID_VALUES_TO_SET'].includes(error.code) ? 400 : 500);
  if (statusCode >= 500 && typeof sails !== 'undefined' && sails.log) {
    sails.log.error(error);
  }
  return res.status(statusCode).json({ error: statusCode >= 500 ? 'Unable to complete the request. Please try again.' : error.message });
}

function publicPet(pet) {
  if (!pet || typeof pet !== 'object') {
    return pet;
  }
  const result = {};
  for (const field of ['id', 'name', 'species', 'breed', 'color', 'age', 'photoURL', 'createdAt', 'updatedAt']) {
    if (pet[field] !== undefined) {
      result[field] = pet[field];
    }
  }
  if (pet.user) {
    result.user = typeof pet.user === 'object' ? pet.user.id : pet.user;
  }
  return result;
}

function publicReport(report) {
  if (!report) {
    return report;
  }
  const result = {};
  for (const field of ['id', 'status', 'description', 'location', 'latitude', 'longitude', 'contactInfo', 'photoUrls', 'category', 'comments', 'petName', 'animalType', 'createdAt', 'updatedAt']) {
    if (report[field] !== undefined) {
      result[field] = report[field];
    }
  }
  if (report.pet) {
    result.pet = publicPet(report.pet);
  }
  if (report.user) {
    result.user = typeof report.user === 'object'
      ? { id: report.user.id, username: report.user.username }
      : report.user;
  }
  return result;
}

module.exports = { httpError, body, text, species, status, age, location, photoURL, authenticatedUser, isOwner, handleError, publicPet, publicReport };
