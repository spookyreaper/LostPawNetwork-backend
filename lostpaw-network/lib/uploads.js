const fs = require('node:fs/promises');
const path = require('node:path');
const { generateId } = require('./id');
const { httpError } = require('./report-validation');

const MAX_PHOTO_BYTES = 10000000;

function getUploadDirectory() {
  const appPath = typeof sails !== 'undefined' && sails.config.appPath || process.cwd();
  const configured = typeof sails !== 'undefined' && sails.config.custom && sails.config.custom.uploadDir;
  return path.resolve(process.env.UPLOAD_DIR || configured || path.join(appPath, '.data/uploads'));
}

function imageExtension(bytes) {
  if (bytes.length >= 3 && bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]))) {
    return 'jpg';
  }
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) {
    return 'png';
  }
  if (['GIF87a', 'GIF89a'].includes(bytes.subarray(0, 6).toString('ascii'))) {
    return 'gif';
  }
  if (bytes.subarray(0, 4).toString('ascii') === 'RIFF' && bytes.subarray(8, 12).toString('ascii') === 'WEBP') {
    return 'webp';
  }
  if (bytes.subarray(4, 8).toString('ascii') === 'ftyp') {
    for (let offset = 8; offset + 4 <= bytes.length; offset += 4) {
      if (['avif', 'avis'].includes(bytes.subarray(offset, offset + 4).toString('ascii'))) {
        return 'avif';
      }
    }
  }
  return null;
}

async function removeUploadedPhoto(photo) {
  if (!photo || !photo.filePath || path.dirname(photo.filePath) !== getUploadDirectory()) {
    return;
  }
  await fs.rm(photo.filePath, { force: true });
}

async function uploadPetPhoto(req) {
  const directory = getUploadDirectory();
  await fs.mkdir(directory, { recursive: true });
  const staging = await fs.mkdtemp(path.join(directory, '.upload-'));
  let destination;
  try {
    if (typeof req.file !== 'function') {
      throw httpError(400, 'A pet photo is required.');
    }
    const files = await new Promise((resolve, reject) => {
      let count = 0;
      req.file('petPhoto').upload({
        dirname: staging,
        maxBytes: MAX_PHOTO_BYTES,
        saveAs: (unusedFile, next) => {
          count += 1;
          if (count > 1) {
            return next(httpError(400, 'Upload exactly one pet photo.'));
          }
          return next(null, `${generateId()}.upload`);
        },
      }, (error, uploadedFiles) => {
        if (error) {
          if (error.code === 'E_EXCEEDS_UPLOAD_LIMIT') {
            return reject(httpError(413, 'Choose a photo no larger than 10 MB.'));
          }
          return reject(error);
        }
        return resolve(uploadedFiles);
      });
    });
    if (!Array.isArray(files) || files.length !== 1) {
      throw httpError(400, 'Upload exactly one pet photo.');
    }
    const filePath = files[0].fd;
    if (typeof filePath !== 'string' || path.dirname(path.resolve(filePath)) !== staging) {
      throw httpError(400, 'Invalid uploaded file.');
    }
    const file = await fs.lstat(filePath);
    if (!file.isFile() || file.size === 0 || file.size > MAX_PHOTO_BYTES) {
      throw httpError(file.size > MAX_PHOTO_BYTES ? 413 : 400, 'Choose a valid image no larger than 10 MB.');
    }
    const handle = await fs.open(filePath, 'r');
    let bytes;
    try {
      const header = Buffer.alloc(64);
      const result = await handle.read(header, 0, header.length, 0);
      bytes = header.subarray(0, result.bytesRead);
    } finally {
      await handle.close();
    }
    const extension = imageExtension(bytes);
    if (!extension) {
      throw httpError(400, 'Choose a JPEG, PNG, GIF, WebP, or AVIF image.');
    }
    const filename = `${generateId()}.${extension}`;
    destination = path.join(directory, filename);
    await fs.rename(filePath, destination);
    return { filePath: destination, url: `/images/pets/${filename}` };
  } catch (error) {
    if (destination) {
      await fs.rm(destination, { force: true });
    }
    throw error;
  } finally {
    await fs.rm(staging, { recursive: true, force: true });
  }
}

module.exports = { getUploadDirectory, uploadPetPhoto, removeUploadedPhoto, MAX_PHOTO_BYTES, imageExtension };
