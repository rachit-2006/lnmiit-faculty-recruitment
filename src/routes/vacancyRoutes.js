// Vacancy Routes
const express = require('express');
const router = express.Router();
const vacancyController = require('../controllers/vacancyController');
const applicationController = require('../controllers/applicationController');
const { authenticate, optionalAuth } = require('../middleware/auth');
const { requireRoles } = require('../middleware/rbac');

// Public or optionally authenticated
router.get('/', optionalAuth, vacancyController.listVacancies);
router.get('/:vacancyId', optionalAuth, vacancyController.getVacancy);

// Restricted to Recruitment Cell and Administrator (FR-008, BR-001)
router.post('/', authenticate, requireRoles('RECRUITMENT_CELL', 'ADMINISTRATOR'), vacancyController.createVacancy);

// Start Application for Vacancy (Applicant only)
router.post('/:vacancyId/applications', authenticate, requireRoles('APPLICANT'), applicationController.startApplication);

module.exports = router;
