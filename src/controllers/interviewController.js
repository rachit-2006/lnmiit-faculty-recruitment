// Interview Panel Controller (UC-009/10, CS-3, CS-5)
const recruitmentService = require('../services/recruitmentService');
const db = require('../db/db');

async function listAssignedInterviews(req, res, next) {
  try {
    const memberId = req.user.memberId;
    if (!memberId && req.user.role !== 'ADMINISTRATOR') {
      return res.status(403).json({
        status: 403,
        code: 'FORBIDDEN',
        message: 'No interview panel member ID associated with your account.',
        path: req.originalUrl,
        timestamp: new Date().toISOString()
      });
    }

    const list = memberId ? recruitmentService.getAssignedInterviews(memberId) : db.data.interviews || [];
    res.status(200).json(list);
  } catch (err) {
    next(err);
  }
}

async function getInterviewDetails(req, res, next) {
  try {
    const interviewId = req.params.interviewId || req.params.id;
    const iv = recruitmentService.getInterview(interviewId);

    if (!iv) {
      return res.status(404).json({
        status: 404,
        code: 'NOT_FOUND',
        message: 'Interview not found',
        path: req.originalUrl,
        timestamp: new Date().toISOString()
      });
    }

    // Role check: Panel member must be assigned to interview (AC-15)
    if (req.user.role === 'INTERVIEW_PANEL') {
      if (!iv.panel || !iv.panel.some(p => p.memberId === req.user.memberId)) {
        return res.status(403).json({
          status: 403,
          code: 'NOT_ASSIGNED',
          message: 'You are not assigned to this interview.',
          path: req.originalUrl,
          timestamp: new Date().toISOString()
        });
      }
    }

    const app = recruitmentService.getApplication(iv.applicationId);
    const profile = app ? recruitmentService.getApplicantProfile(app.applicantId) : null;

    res.status(200).json({
      interview: iv,
      application: app,
      profile
    });
  } catch (err) {
    next(err);
  }
}

async function markAttendance(req, res, next) {
  try {
    const interviewId = req.params.interviewId || req.params.id;
    const memberId = req.user.memberId;
    const attended = req.body.attended !== false;

    const result = recruitmentService.markAttendance(interviewId, memberId, attended);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

async function submitEvaluation(req, res, next) {
  try {
    const interviewId = req.params.interviewId || req.params.id;
    const memberId = req.user.memberId;
    const { score, comments } = req.body || {};

    const result = recruitmentService.submitEvaluation(memberId, interviewId, score, comments);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

async function getEvaluationSummary(req, res, next) {
  try {
    const interviewId = req.params.interviewId || req.params.id;
    const iv = recruitmentService.getInterview(interviewId);

    if (!iv) {
      return res.status(404).json({
        status: 404,
        code: 'NOT_FOUND',
        message: 'Interview not found',
        path: req.originalUrl,
        timestamp: new Date().toISOString()
      });
    }

    res.status(200).json({
      interviewId: iv.interviewId,
      candidateName: iv.candidateName,
      status: iv.status,
      evaluations: iv.evaluations || [],
      aggregateScore: iv.aggregateScore,
      panelSize: iv.panel.length,
      recommendation: iv.recommendation,
      panelRemarks: iv.panelRemarks,
      finalized: iv.finalized
    });
  } catch (err) {
    next(err);
  }
}

async function finalizeInterview(req, res, next) {
  try {
    const interviewId = req.params.interviewId || req.params.id;
    const memberId = req.user.memberId;
    const { recommendation, remarks } = req.body || {};

    const result = recruitmentService.finalizeInterview(memberId, interviewId, recommendation, remarks);
    res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listAssignedInterviews,
  getInterviewDetails,
  markAttendance,
  submitEvaluation,
  getEvaluationSummary,
  finalizeInterview
};
