// Application Configuration
const path = require('path');

module.exports = {
  PORT: process.env.PORT || 3000,
  DATA_DIR: path.join(__dirname, '..', 'data'),
  DB_FILE: path.join(__dirname, '..', 'data', 'database.json'),
  STORAGE_DIR: path.join(__dirname, '..', 'storage', 'documents'),
  PUBLIC_DIR: path.join(__dirname, '..', 'public'),
  SESSION_EXPIRY_HOURS: 12,
  MAX_FILE_SIZE_KB: 2048,
  ALLOWED_EXTENSIONS: ['pdf', 'jpg', 'jpeg', 'png'],
  PASSWORD_MIN_LENGTH: 10
};
