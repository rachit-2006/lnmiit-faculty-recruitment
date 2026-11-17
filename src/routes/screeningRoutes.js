// Recruitment Cell Screening Routes
const express = require('express');
const router = express.Router();
const screeningController = require('../controllers/screeningController');
const applicationController = require('../controllers/applicationController');
const appointmentController = require('../controllers/appointmentController');
const { authenticate } = require('../middleware/auth');
const { requireRoles } = require('../middleware/rbac');

// All RC routes require authentication
router.use(authenticate);

// List applications for vacancy screening (Accessible by RECRUITMENT_CELL, HOD, ADMINISTRATOR)
router.get('/vacancies/:vacancyId/applications', requireRoles('RECRUITMENT_CELL', 'HOD', 'ADMINISTRATOR'), screeningController.listApplicationsForScreening);

// Application details for screening (Accessible by RECRUITMENT_CELL, HOD, ADMINISTRATOR)
router.get('/applications/:id', requireRoles('RECRUITMENT_CELL', 'HOD', 'ADMINISTRATOR'), applicationController.getApplicationDetails);

// Document verification toggle (S-08) - RC only
router.post('/applications/:id/verify-doc', requireRoles('RECRUITMENT_CELL', 'ADMINISTRATOR'), screeningController.verifyDocument);

// Record screening result (S-08) - RC only
router.post('/applications/:id/screening', requireRoles('RECRUITMENT_CELL', 'ADMINISTRATOR'), screeningController.recordScreeningResult);

// Appointment letter generation (UC-013) - RC only
router.post('/applications/:id/appointment-letter', requireRoles('RECRUITMENT_CELL', 'ADMINISTRATOR'), appointmentController.generateAppointmentLetter);

module.exports = router;
