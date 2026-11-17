// Authentication Controller implementing Registration, Login, Logout & Session checks
const db = require('../db/db');
const {
  hashPassword,
  verifyPassword,
  generateSessionToken,
  validateRegistrationInput
} = require('../services/authService');
const { recordAuditLog } = require('../services/auditService');
const config = require('../config');

/**
 * Applicant Public Registration (FR-001)
 */
async function register(req, res, next) {
  try {
    const { name, email, password, confirmPassword, phone } = req.body || {};

    // 1. Input validation
    const validation = validateRegistrationInput({ name, email, password, confirmPassword, phone });
    if (!validation.valid) {
      return res.status(422).json({
        status: 422,
        code: 'VALIDATION_FAILED',
        message: validation.errors[0].message,
        fields: validation.errors,
        path: req.originalUrl,
        timestamp: new Date().toISOString()
      });
    }

    const cleanEmail = email.trim().toLowerCase();

    // 2. Duplicate prevention (FR-016, BR-003)
    const existing = db.findUserByEmail(cleanEmail);
    if (existing) {
      return res.status(409).json({
        status: 409,
        code: 'DUPLICATE_EMAIL',
        message: 'This email address is already registered. Please sign in or use another email.',
        path: req.originalUrl,
        timestamp: new Date().toISOString()
      });
    }

    // 3. Password hashing with unique random salt via crypto.scrypt
    const passwordHash = await hashPassword(password);

    // 4. Generate unique IDs
    const timestamp = Date.now().toString().slice(-4);
    const randomSuffix = Math.random().toString(36).substring(2, 5).toUpperCase();
    const userId = `U${timestamp}${randomSuffix}`;
    const applicantId = `A${timestamp}${randomSuffix}`;
    const profileId = `P${timestamp}${randomSuffix}`;

    // 5. Create user record (strictly enforced role APPLICANT)
    const newUser = {
      userId,
      name: name.trim(),
      email: cleanEmail,
      passwordHash,
      role: 'APPLICANT', // Users cannot self-assign administrative roles
      active: true,
      applicantId,
      phone: phone ? phone.trim() : ''
    };

    db.addUser(newUser);

    // 6. Initialize applicant profile record
    db.saveApplicantProfile(applicantId, {
      profileId,
      applicantId,
      phone: newUser.phone,
      dateOfBirth: '',
      willingnessToRelocate: true,
      hasDisability: false,
      education: [],
      experience: [],
      researchPapers: []
    });

    // 7. Auto-login: generate secure session token
    const token = generateSessionToken();
    const expiresAt = new Date(Date.now() + config.SESSION_EXPIRY_HOURS * 3600 * 1000).toISOString();

    const session = {
      sessionId: `SES-${Date.now().toString().slice(-4)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      token,
      userId: newUser.userId,
      role: newUser.role,
      applicantId: newUser.applicantId,
      createdAt: new Date().toISOString(),
      expiresAt
    };

    db.createSession(session);

    // 8. Immutable audit trail
    recordAuditLog(userId, 'APPLICANT_REGISTERED', 'User', userId);
    recordAuditLog(userId, 'USER_LOGIN', 'User', userId);

    // 9. Response (never expose passwordHash!)
    return res.status(201).json({
      status: 201,
      message: 'Registration successful. Welcome to the LNMIIT Faculty Recruitment Portal.',
      token,
      user: {
        userId: newUser.userId,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        applicantId: newUser.applicantId,
        phone: newUser.phone
      }
    });

  } catch (err) {
    next(err);
  }
}

/**
 * User Login (FR-002, FR-003, FR-004)
 */
async function login(req, res, next) {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(401).json({
        status: 401,
        code: 'AUTH_FAILED',
        message: 'Invalid email or password. Please try again.',
        path: req.originalUrl,
        timestamp: new Date().toISOString()
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = db.findUserByEmail(cleanEmail);

    if (!user) {
      // Generic error message without revealing user existence (FR-004)
      return res.status(401).json({
        status: 401,
        code: 'AUTH_FAILED',
        message: 'Invalid email or password. Please try again.',
        path: req.originalUrl,
        timestamp: new Date().toISOString()
      });
    }

    if (!user.active) {
      return res.status(401).json({
        status: 401,
        code: 'ACCOUNT_INACTIVE',
        message: 'Account is currently inactive. Please contact recruitment administrator.',
        path: req.originalUrl,
        timestamp: new Date().toISOString()
      });
    }

    // Verify password hash
    const passwordMatch = await verifyPassword(password, user.passwordHash);
    if (!passwordMatch) {
      return res.status(401).json({
        status: 401,
        code: 'AUTH_FAILED',
        message: 'Invalid email or password. Please try again.',
        path: req.originalUrl,
        timestamp: new Date().toISOString()
      });
    }

    // Generate secure session
    const token = generateSessionToken();
    const expiresAt = new Date(Date.now() + config.SESSION_EXPIRY_HOURS * 3600 * 1000).toISOString();

    const session = {
      sessionId: `SES-${Date.now().toString().slice(-4)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
      token,
      userId: user.userId,
      role: user.role,
      applicantId: user.applicantId,
      employeeId: user.employeeId,
      memberId: user.memberId,
      hodId: user.hodId,
      department: user.department,
      createdAt: new Date().toISOString(),
      expiresAt
    };

    db.createSession(session);
    recordAuditLog(user.userId, 'USER_LOGIN', 'User', user.userId);

    return res.status(200).json({
      status: 200,
      token,
      userId: user.userId,
      name: user.name,
      email: user.email,
      role: user.role,
      applicantId: user.applicantId,
      employeeId: user.employeeId,
      memberId: user.memberId,
      hodId: user.hodId,
      department: user.department,
      user: {
        userId: user.userId,
        name: user.name,
        email: user.email,
        role: user.role,
        applicantId: user.applicantId,
        employeeId: user.employeeId,
        memberId: user.memberId,
        hodId: user.hodId,
        department: user.department
      }
    });

  } catch (err) {
    next(err);
  }
}

/**
 * User Logout (FR-005)
 */
async function logout(req, res, next) {
  try {
    const authHeader = req.headers['authorization'] || '';
    if (authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '').trim();
      db.deleteSession(token);
    }
    if (req.user) {
      recordAuditLog(req.user.userId, 'USER_LOGOUT', 'User', req.user.userId);
    }
    return res.status(200).json({
      status: 200,
      message: 'Logged out successfully.'
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get current session profile / verification
 */
async function getCurrentUser(req, res, next) {
  try {
    return res.status(200).json(req.user);
  } catch (err) {
    next(err);
  }
}

/**
 * Demo users list (convenience for demo presentation)
 */
async function getDemoUsers(req, res, next) {
  try {
    // Return sanitized users list without password hashes
    const sanitized = (db.data.users || []).map(u => ({
      userId: u.userId,
      name: u.name,
      email: u.email,
      role: u.role,
      applicantId: u.applicantId,
      employeeId: u.employeeId,
      memberId: u.memberId,
      hodId: u.hodId,
      department: u.department
    }));
    return res.status(200).json(sanitized);
  } catch (err) {
    next(err);
  }
}

/**
 * Reset demo data to initial seed
 */
async function resetDemoData(req, res, next) {
  try {
    await db.reset();
    return res.status(200).json({ message: 'Prototype data reset successfully to initial state.' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  register,
  login,
  logout,
  getCurrentUser,
  getDemoUsers,
  resetDemoData
};
