// Database Studio & Management Routes
const express = require('express');
const router = express.Router();
const databaseController = require('../controllers/databaseController');
const { optionalAuth } = require('../middleware/auth');

// Database Status & Metadata (Accessible for verification/demo)
router.get('/status', optionalAuth, databaseController.getStatus);
router.get('/tables', optionalAuth, databaseController.getTables);
router.get('/tables/:table', optionalAuth, databaseController.getTableData);

// SQL Query Console
router.post('/query', optionalAuth, databaseController.executeQuery);

// SQL Dump File Download
router.get('/export/sql', optionalAuth, databaseController.exportSqlDump);

module.exports = router;
