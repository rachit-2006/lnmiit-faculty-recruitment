// HOD Review & Decision Controller (UC-012, FR-027, FR-028)
const recruitmentService = require('../services/recruitmentService');
const db = require('../db/db');

async function listShortlistedApplications(req, res, next) {
  try {
    const userDept = req.user.department;
    let apps = db.data.applications || [];

    // Filter by HOD department
    if (req.user.role === 'HOD' && userDept) {
      apps = apps.filter(a => {
        const v = db.getVacancy(a.vacancyId);
        return v && v.department.toLowerCase() === userDept.toLowerCase();
      });
    }

    // Only applications ready for HOD review (SHORTLISTED, APPROVED_BY_HOD, REJECTED_BY_HOD)
    const filtered = apps.filter(a => ['SHORTLISTED', 'APPROVED_BY_HOD', 'REJECTED_BY_HOD', 'APPOINTED'].includes(a.status));
    res.status(200).json(filtered);
  } catch (err) {
    next(err);
  }
}

async function hodDecision(req, res, next) {
  try {
    const applicationId = req.params.applicationId || req.params.id;
    const { decision, comments } = req.body || {};
    const hodId = req.user.hodId || req.user.userId;

    const result = recruitmentService.hodDecision(hodId, applicationId, decision, comments);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listShortlistedApplications,
  hodDecision
};
