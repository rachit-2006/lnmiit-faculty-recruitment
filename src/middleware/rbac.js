// Role-Based Access Control Middleware (FR-006, BR-002)
const db = require('../db/db');

// Role alias mapping
const ROLE_ALIASES = {
  'ADMIN': 'ADMINISTRATOR',
  'COMMITTEE': 'INTERVIEW_PANEL',
  'RECRUITER': 'RECRUITMENT_CELL'
};

function normalizeRole(role) {
  return ROLE_ALIASES[role] || role;
}

/**
 * Restrict endpoint access to specified roles
 * @param  {...string} allowedRoles 
 */
function requireRoles(...allowedRoles) {
  const normalizedAllowed = allowedRoles.map(normalizeRole);

  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        status: 401,
        code: 'AUTH_REQUIRED',
        message: 'Authentication required. Please sign in to continue.',
        path: req.originalUrl || req.path,
        timestamp: new Date().toISOString()
      });
    }

    const userRole = normalizeRole(req.user.role);

    // Administrator always has access to administrative operations
    if (userRole === 'ADMINISTRATOR') {
      return next();
    }

    if (!normalizedAllowed.includes(userRole)) {
      return res.status(403).json({
        status: 403,
        code: 'FORBIDDEN',
        message: 'You do not have permission to perform this action.',
        path: req.originalUrl || req.path,
        timestamp: new Date().toISOString()
      });
    }

    next();
  };
}

/**
 * Ensures an applicant can only access/modify their own applications
 */
function requireApplicantOwnership(req, res, next) {
  const applicationId = req.params.applicationId || req.params.id;
  const app = db.getApplication(applicationId);

  if (!app) {
    return res.status(404).json({
      status: 404,
      code: 'NOT_FOUND',
      message: 'Application not found',
      path: req.originalUrl || req.path,
      timestamp: new Date().toISOString()
    });
  }

  // If user is applicant, ensure ownership
  if (normalizeRole(req.user.role) === 'APPLICANT') {
    if (app.applicantId !== req.user.applicantId) {
      return res.status(403).json({
        status: 403,
        code: 'FORBIDDEN',
        message: 'You do not have permission to access another applicant\'s application.',
        path: req.originalUrl || req.path,
        timestamp: new Date().toISOString()
      });
    }
  }

  req.application = app;
  next();
}

/**
 * Ensures HOD only accesses applications within their department
 */
function requireDepartmentMatch(req, res, next) {
  const applicationId = req.params.applicationId || req.params.id;
  const app = db.getApplication(applicationId);

  if (!app) {
    return res.status(404).json({
      status: 404,
      code: 'NOT_FOUND',
      message: 'Application not found',
      path: req.originalUrl || req.path,
      timestamp: new Date().toISOString()
    });
  }

  const vacancy = db.getVacancy(app.vacancyId);
  if (!vacancy) {
    return res.status(404).json({
      status: 404,
      code: 'NOT_FOUND',
      message: 'Vacancy not found',
      path: req.originalUrl || req.path,
      timestamp: new Date().toISOString()
    });
  }

  const userRole = normalizeRole(req.user.role);
  if (userRole === 'HOD') {
    if (!req.user.department || vacancy.department.toLowerCase() !== req.user.department.toLowerCase()) {
      return res.status(403).json({
        status: 403,
        code: 'FORBIDDEN',
        message: `Access denied. HOD can only review applications in the ${req.user.department} department.`,
        path: req.originalUrl || req.path,
        timestamp: new Date().toISOString()
      });
    }
  }

  req.application = app;
  req.vacancy = vacancy;
  next();
}

module.exports = {
  requireRoles,
  requireApplicantOwnership,
  requireDepartmentMatch,
  normalizeRole
};
