// Application Configuration
const path = require('path');
const os = require('os');

const isVercel = Boolean(process.env.VERCEL || process.env.NOW_REGION);
const dataDir = isVercel ? path.join(os.tmpdir(), 'lnmiit-data') : path.join(__dirname, '..', 'data');
const storageDir = isVercel ? path.join(os.tmpdir(), 'lnmiit-storage', 'documents') : path.join(__dirname, '..', 'storage', 'documents');

module.exports = {
  PORT: process.env.PORT || 3000,
  DATA_DIR: dataDir,
  DB_FILE: path.join(dataDir, 'database.json'),
  STORAGE_DIR: storageDir,
  PUBLIC_DIR: path.join(__dirname, '..', 'public'),
  SESSION_EXPIRY_HOURS: 12,
  MAX_FILE_SIZE_KB: 2048,
  ALLOWED_EXTENSIONS: ['pdf', 'jpg', 'jpeg', 'png'],
  PASSWORD_MIN_LENGTH: 10,
  IS_VERCEL: isVercel
};
