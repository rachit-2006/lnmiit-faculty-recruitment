// Audit Log Routes (NFR-007, NFR-020)
const express = require('express');
const router = express.Router();
const auditController = require('../controllers/auditController');
const { authenticate } = require('../middleware/auth');
const { requireRoles } = require('../middleware/rbac');

// Audit logs can be viewed by staff (RECRUITMENT_CELL, HOD, ADMINISTRATOR)
router.get('/', authenticate, requireRoles('RECRUITMENT_CELL', 'HOD', 'ADMINISTRATOR'), auditController.getAuditLogs);

module.exports = router;
