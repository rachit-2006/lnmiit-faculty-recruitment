// Document Routes
const express = require('express');
const router = express.Router();
const documentController = require('../controllers/documentController');
const { authenticate } = require('../middleware/auth');

// Secure document viewing/downloading with authorization
router.get('/:documentId/file', authenticate, documentController.downloadDocument);
router.get('/:documentId/download', authenticate, documentController.downloadDocument);

module.exports = router;
