// Application Routes
const express = require('express');
const router = express.Router();
const multer = require('multer');
const applicationController = require('../controllers/applicationController');
const documentController = require('../controllers/documentController');
const { authenticate } = require('../middleware/auth');
const { requireRoles, requireApplicantOwnership } = require('../middleware/rbac');
const db = require('../db/db');

// Multer memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 } // 2MB limit
});

// My applications (Applicant only)
router.get('/my', authenticate, requireRoles('APPLICANT'), applicationController.getMyApplications);

// Application status
router.get('/:id/status', authenticate, applicationController.getApplicationStatus);

// Application details (accessible by owner applicant or staff)
router.get('/:id', authenticate, (req, res, next) => {
  const app = db.getApplication(req.params.id);
  if (!app) {
    return res.status(404).json({
      status: 404,
      code: 'NOT_FOUND',
      message: 'Application not found',
      path: req.originalUrl,
      timestamp: new Date().toISOString()
    });
  }
  if (req.user.role === 'APPLICANT' && app.applicantId !== req.user.applicantId) {
    return res.status(403).json({
      status: 403,
      code: 'FORBIDDEN',
      message: 'You do not have permission to view another applicant\'s application.',
      path: req.originalUrl,
      timestamp: new Date().toISOString()
    });
  }
  return applicationController.getApplicationDetails(req, res, next);
});

// Save draft (Applicant only, ownership verified)
router.put('/:id', authenticate, requireRoles('APPLICANT'), requireApplicantOwnership, applicationController.saveDraft);

// Submit application (Applicant only, ownership verified)
router.post('/:id/submit', authenticate, requireRoles('APPLICANT'), requireApplicantOwnership, applicationController.submitApplication);

// Upload document (Applicant only, ownership verified)
router.post('/:id/documents', authenticate, requireRoles('APPLICANT'), requireApplicantOwnership, upload.single('file'), documentController.uploadDocument);

module.exports = router;
