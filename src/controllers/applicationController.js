// Application Controller
const recruitmentService = require('../services/recruitmentService');

async function startApplication(req, res, next) {
  try {
    const vacancyId = req.params.vacancyId;
    // Always use verified applicantId from session, ignore client spoofing
    const applicantId = req.user.applicantId;

    if (!applicantId) {
      return res.status(403).json({
        status: 403,
        code: 'FORBIDDEN',
        message: 'Applicant profile not linked to this user account.',
        path: req.originalUrl,
        timestamp: new Date().toISOString()
      });
    }

    const result = recruitmentService.startApplication(applicantId, vacancyId);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

async function saveDraft(req, res, next) {
  try {
    const applicationId = req.params.id;
    const applicantId = req.user.applicantId;
    const result = recruitmentService.saveDraft(applicationId, req.body, applicantId);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

async function submitApplication(req, res, next) {
  try {
    const applicationId = req.params.id;
    const applicantId = req.user.applicantId;
    const result = recruitmentService.submitApplication(applicantId, applicationId);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

async function getMyApplications(req, res, next) {
  try {
    const applicantId = req.user.applicantId;
    const apps = recruitmentService.getApplicationsByApplicant(applicantId);
    res.status(200).json(apps);
  } catch (err) {
    next(err);
  }
}

async function getApplicationStatus(req, res, next) {
  try {
    const applicationId = req.params.id;
    const app = recruitmentService.getApplication(applicationId);
    if (!app) {
      return res.status(404).json({
        status: 404,
        code: 'NOT_FOUND',
        message: 'Application not found',
        path: req.originalUrl,
        timestamp: new Date().toISOString()
      });
    }

    // Role check: Applicant can only access own application status
    if (req.user.role === 'APPLICANT' && app.applicantId !== req.user.applicantId) {
      return res.status(403).json({
        status: 403,
        code: 'FORBIDDEN',
        message: 'You do not have permission to access another applicant\'s status.',
        path: req.originalUrl,
        timestamp: new Date().toISOString()
      });
    }

    res.status(200).json({
      applicationId: app.applicationId,
      status: app.status,
      submissionDate: app.submissionDate,
      screeningRecord: app.screeningRecord,
      interviewId: app.interviewId,
      hodReview: app.hodReview,
      appointmentLetter: app.appointmentLetter
    });
  } catch (err) {
    next(err);
  }
}

async function getApplicationDetails(req, res, next) {
  try {
    const applicationId = req.params.id;
    const app = recruitmentService.getApplication(applicationId);
    if (!app) {
      return res.status(404).json({
        status: 404,
        code: 'NOT_FOUND',
        message: 'Application not found',
        path: req.originalUrl,
        timestamp: new Date().toISOString()
      });
    }

    const profile = recruitmentService.getApplicantProfile(app.applicantId);
    const vacancy = recruitmentService.getVacancy(app.vacancyId);
    const suggestion = recruitmentService.suggestEligibility(app.applicationId);

    res.status(200).json({
      application: app,
      profile,
      vacancy,
      suggestion
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  startApplication,
  saveDraft,
  submitApplication,
  getMyApplications,
  getApplicationStatus,
  getApplicationDetails
};
