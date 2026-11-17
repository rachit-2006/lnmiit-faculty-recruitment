// HOD Review Routes (UC-012)
const express = require('express');
const router = express.Router();
const hodController = require('../controllers/hodController');
const { authenticate } = require('../middleware/auth');
const { requireRoles, requireDepartmentMatch } = require('../middleware/rbac');

// All HOD routes require HOD or ADMINISTRATOR
router.use(authenticate, requireRoles('HOD', 'ADMINISTRATOR'));

// List shortlisted candidates for HOD department
router.get('/applications', hodController.listShortlistedApplications);

// Record HOD decision (with department match check)
router.post('/applications/:id/decision', requireDepartmentMatch, hodController.hodDecision);

module.exports = router;
