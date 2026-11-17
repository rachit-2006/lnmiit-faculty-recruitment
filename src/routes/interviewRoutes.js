// Interview Panel Routes (UC-009/10)
const express = require('express');
const router = express.Router();
const interviewController = require('../controllers/interviewController');
const { authenticate } = require('../middleware/auth');
const { requireRoles } = require('../middleware/rbac');

// All panel routes require INTERVIEW_PANEL or ADMINISTRATOR
router.use(authenticate, requireRoles('INTERVIEW_PANEL', 'ADMINISTRATOR'));

// List assigned interviews (S-09)
router.get('/interviews', interviewController.listAssignedInterviews);

// Interview details (S-10)
router.get('/interviews/:id', interviewController.getInterviewDetails);

// Mark candidate attendance (S-10)
router.post('/interviews/:id/attendance', interviewController.markAttendance);

// Submit evaluation score and comments (S-10)
router.post('/interviews/:id/evaluations', interviewController.submitEvaluation);

// Evaluation summary (S-11)
router.get('/interviews/:id/summary', interviewController.getEvaluationSummary);

// Finalize interview recommendation (S-11)
router.post('/interviews/:id/recommendation', interviewController.finalizeInterview);

module.exports = router;
