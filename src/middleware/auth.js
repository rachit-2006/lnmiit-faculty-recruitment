// Authentication Middleware
const db = require('../db/db');

/**
 * Require valid session token on protected endpoints
 */
async function authenticate(req, res, next) {
  await db.init();
  const authHeader = req.headers['authorization'] || '';
  if (!authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      status: 401,
      code: 'AUTH_REQUIRED',
      message: 'Authentication required. Please sign in to continue.',
      path: req.originalUrl || req.path,
      timestamp: new Date().toISOString()
    });
  }

  const token = authHeader.replace('Bearer ', '').trim();
  const session = db.findSession(token);

  if (!session) {
    return res.status(401).json({
      status: 401,
      code: 'SESSION_INVALID',
      message: 'Invalid session token. Please sign in again.',
      path: req.originalUrl || req.path,
      timestamp: new Date().toISOString()
    });
  }

  // Check 12-hour session expiration
  if (new Date() > new Date(session.expiresAt)) {
    db.deleteSession(token);
    return res.status(401).json({
      status: 401,
      code: 'SESSION_EXPIRED',
      message: 'Your session has expired. Please log in again.',
      path: req.originalUrl || req.path,
      timestamp: new Date().toISOString()
    });
  }

  const user = db.findUserById(session.userId);
  if (!user || !user.active) {
    db.deleteSession(token);
    return res.status(401).json({
      status: 401,
      code: 'ACCOUNT_INACTIVE',
      message: 'Account is inactive or not found.',
      path: req.originalUrl || req.path,
      timestamp: new Date().toISOString()
    });
  }

  // Attach authentic, verified user information to request
  req.user = {
    userId: user.userId,
    name: user.name,
    email: user.email,
    role: user.role,
    applicantId: user.applicantId,
    employeeId: user.employeeId,
    memberId: user.memberId,
    hodId: user.hodId,
    department: user.department
  };
  req.session = session;

  next();
}

/**
 * Optional authentication: attaches req.user if a valid token is provided, but continues if not
 */
async function optionalAuth(req, res, next) {
  await db.init();
  const authHeader = req.headers['authorization'] || '';
  if (authHeader.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '').trim();
    const session = db.findSession(token);
    if (session && new Date() <= new Date(session.expiresAt)) {
      const user = db.findUserById(session.userId);
      if (user && user.active) {
        req.user = {
          userId: user.userId,
          name: user.name,
          email: user.email,
          role: user.role,
          applicantId: user.applicantId,
          employeeId: user.employeeId,
          memberId: user.memberId,
          hodId: user.hodId,
          department: user.department
        };
        req.session = session;
      }
    }
  }
  next();
}

module.exports = {
  authenticate,
  optionalAuth
};
