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
        if (!v) return false;
        const vDept = v.department.toLowerCase();
        const uDept = userDept.toLowerCase();
        return vDept === uDept || vDept.includes(uDept) || uDept.includes(vDept);
      });
    }

    // Only applications ready for HOD review (SHORTLISTED, APPROVED_BY_HOD, REJECTED_BY_HOD, APPOINTED)
    let filtered = apps.filter(a => ['SHORTLISTED', 'APPROVED_BY_HOD', 'REJECTED_BY_HOD', 'APPOINTED'].includes(a.status));

    // Fallback: If no candidate is yet shortlisted in demo, show eligible/interviewed candidates in the department
    if (filtered.length === 0) {
      filtered = apps.filter(a => a.interviewId || a.status === 'ELIGIBLE');
    }

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
