// Recruitment Cell Screening Controller (UC-007, CS-2)
const recruitmentService = require('../services/recruitmentService');

async function listApplicationsForScreening(req, res, next) {
  try {
    const vacancyId = req.params.vacancyId;
    const list = recruitmentService.getApplicationsForScreening(vacancyId);
    res.status(200).json(list);
  } catch (err) {
    next(err);
  }
}

async function recordScreeningResult(req, res, next) {
  try {
    const applicationId = req.params.applicationId || req.params.id;
    const { result, comments } = req.body || {};
    const rcUserId = req.user.userId;

    const record = recruitmentService.recordScreeningResult(
      rcUserId,
      applicationId,
      result,
      comments
    );

    res.status(201).json(record);
  } catch (err) {
    next(err);
  }
}

async function verifyDocument(req, res, next) {
  try {
    const applicationId = req.params.applicationId || req.params.id;
    const { documentId, status } = req.body || {};

    recruitmentService.updateDocumentVerification(applicationId, documentId, status);
    res.status(200).json({ success: true, message: `Document verification status set to ${status}.` });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listApplicationsForScreening,
  recordScreeningResult,
  verifyDocument
};
