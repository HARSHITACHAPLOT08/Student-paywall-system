const fs = require('fs');
const path = require('path');

// If STORAGE_ROOT is set (e.g. to a Render disk mount path),
// all persistent data will be stored inside it.
// Locally, we default to a ./storage folder inside the project.
const rootFromEnv = process.env.STORAGE_ROOT;
const baseRoot = rootFromEnv || path.join(__dirname, '..', 'storage');

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

ensureDir(baseRoot);

const uploadsRoot = path.join(baseRoot, 'uploads');
const dataRoot = path.join(baseRoot, 'data');

ensureDir(uploadsRoot);
ensureDir(dataRoot);

function getDataFile(name) {
  return path.join(dataRoot, name);
}

module.exports = {
  baseRoot,
  uploadsRoot,
  dataRoot,
  getDataFile,
};
