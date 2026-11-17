// Document Service with Magic Byte Inspection, Secure Storage & Path Traversal Prevention
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('../config');

// Recognized magic signatures
const MAGIC_SIGNATURES = {
  pdf: [0x25, 0x50, 0x44, 0x46], // %PDF
  jpg: [0xFF, 0xD8, 0xFF],       // JPEG
  jpeg: [0xFF, 0xD8, 0xFF],      // JPEG
  png: [0x89, 0x50, 0x4E, 0x47]  // .PNG
};

/**
 * Validate that the buffer begins with the magic signature for the declared type
 * @param {Buffer} buffer 
 * @param {string} ext Lowercase extension without dot
 * @returns {boolean}
 */
function verifyMagicBytes(buffer, ext) {
  if (!buffer || buffer.length < 4) return false;
  const expected = MAGIC_SIGNATURES[ext];
  if (!expected) return false;

  for (let i = 0; i < expected.length; i++) {
    if (buffer[i] !== expected[i]) {
      return false;
    }
  }
  return true;
}

/**
 * Sanitize filename to prevent directory traversal or script injection
 * @param {string} originalName 
 * @returns {string} Safe base filename
 */
function sanitizeFileName(originalName) {
  if (!originalName) return 'document';
  const base = path.basename(originalName);
  return base.replace(/[^a-zA-Z0-9._-]/g, '_');
}

/**
 * Process and safely store an uploaded document
 * @param {Object} file - Multer file object or { buffer, originalname, size, mimetype }
 * @param {string} applicationId 
 * @param {string} documentType 
 * @returns {Object} Stored document metadata
 */
function saveUploadedDocument(file, applicationId, documentType) {
  if (!file) {
    const err = new Error('No document file was uploaded.');
    err.status = 422; err.code = 'MISSING_FILE';
    throw err;
  }

  const safeOriginalName = sanitizeFileName(file.originalname);
  const ext = safeOriginalName.split('.').pop().toLowerCase();

  // 1. Extension check
  if (!config.ALLOWED_EXTENSIONS.includes(ext)) {
    const err = new Error(`${safeOriginalName} could not be accepted. Allowed formats are PDF, JPG and PNG, up to 2 MB.`);
    err.status = 422; err.code = 'INVALID_DOCUMENT';
    throw err;
  }

  // 2. Size check
  const sizeBytes = file.size || (file.buffer ? file.buffer.length : 0);
  const sizeKB = Math.max(1, Math.round(sizeBytes / 1024));
  if (sizeBytes <= 0) {
    const err = new Error(`File is empty.`);
    err.status = 422; err.code = 'INVALID_DOCUMENT';
    throw err;
  }
  if (sizeBytes > config.MAX_FILE_SIZE_KB * 1024) {
    const err = new Error(`File size ${sizeKB} KB exceeds permitted limit (max ${config.MAX_FILE_SIZE_KB} KB).`);
    err.status = 422; err.code = 'INVALID_DOCUMENT';
    throw err;
  }

  // 3. Read buffer for magic byte inspection
  let buffer = file.buffer;
  if (!buffer && file.path) {
    buffer = fs.readFileSync(file.path);
  }

  if (!verifyMagicBytes(buffer, ext)) {
    // If temp file on disk, remove it
    if (file.path && fs.existsSync(file.path)) {
      try { fs.unlinkSync(file.path); } catch (e) {}
    }
    const err = new Error(`Uploaded file '${safeOriginalName}' content does not match its declared format.`);
    err.status = 422; err.code = 'INVALID_DOCUMENT';
    throw err;
  }

  // 4. Generate unique safe storage name
  const uuid = crypto.randomUUID();
  const safeStorageName = `DOC_${uuid}_${safeOriginalName}`;
  const targetDir = config.STORAGE_DIR;

  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const finalPath = path.join(targetDir, safeStorageName);

  // Security: verify target path is inside storage directory (prevent path traversal)
  if (!finalPath.startsWith(path.resolve(targetDir))) {
    const err = new Error('Invalid file storage path.');
    err.status = 400; err.code = 'INVALID_PATH';
    throw err;
  }

  // Save file to disk
  if (file.buffer) {
    fs.writeFileSync(finalPath, file.buffer);
  } else if (file.path) {
    fs.copyFileSync(file.path, finalPath);
    try { fs.unlinkSync(file.path); } catch (e) {}
  }

  return {
    documentId: `DOC-${Date.now().toString().slice(-4)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
    documentType,
    fileName: safeOriginalName,
    storagePath: finalPath,
    fileSizeKB: sizeKB || 1,
    mimeType: file.mimetype || (ext === 'pdf' ? 'application/pdf' : `image/${ext}`),
    uploadDate: new Date().toISOString(),
    verificationStatus: 'PENDING'
  };
}

module.exports = {
  verifyMagicBytes,
  sanitizeFileName,
  saveUploadedDocument
};
