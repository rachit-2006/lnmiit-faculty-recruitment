// Recruitment Cell Screening Routes
const express = require('express');
const router = express.Router();
const screeningController = require('../controllers/screeningController');
const applicationController = require('../controllers/applicationController');
const appointmentController = require('../controllers/appointmentController');
const { authenticate } = require('../middleware/auth');
const { requireRoles } = require('../middleware/rbac');

// All RC routes require RECRUITMENT_CELL or ADMINISTRATOR
router.use(authenticate, requireRoles('RECRUITMENT_CELL', 'ADMINISTRATOR'));

// List applications for vacancy screening (S-07)
router.get('/vacancies/:vacancyId/applications', screeningController.listApplicationsForScreening);

// Application details for screening (S-08)
router.get('/applications/:id', applicationController.getApplicationDetails);

// Document verification toggle (S-08)
router.post('/applications/:id/verify-doc', screeningController.verifyDocument);

// Record screening result (S-08)
router.post('/applications/:id/screening', screeningController.recordScreeningResult);

// Appointment letter generation (UC-013)
router.post('/applications/:id/appointment-letter', appointmentController.generateAppointmentLetter);

module.exports = router;
