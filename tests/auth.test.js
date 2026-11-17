// Authentication & Session Management Automated Test Suite
const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const { request, db, CREDENTIALS } = require('./testHelper');

before(async () => {
  await db.init();
  await db.reset();
});

describe('Authentication & Account Management Test Suite', () => {

  describe('FR-001: Applicant Registration', () => {
    const testEmail = `newcandidate_${Date.now()}@testlnmiit.ac.in`;

    it('should successfully register a new applicant with valid credentials (>=10 char password)', async () => {
      const res = await request({
        method: 'POST',
        url: '/api/auth/register',
        body: {
          name: 'Dr. John Test Doe',
          email: testEmail,
          password: 'Password@12345',
          confirmPassword: 'Password@12345',
          phone: '9876543210'
        }
      });

      assert.equal(res.status, 201);
      assert.ok(res.data.token, 'Must return a session token upon auto-login');
      assert.ok(res.data.user, 'Must return user object');
      assert.equal(res.data.user.role, 'APPLICANT', 'Must strictly auto-assign APPLICANT role');
      assert.equal(res.data.user.email, testEmail);
      assert.ok(!res.data.user.passwordHash, 'Must NEVER expose password hash in response');
      assert.ok(!res.data.user.salt, 'Must NEVER expose salt in response');
    });

    it('should reject registration when email is already registered (409 Conflict)', async () => {
      const res = await request({
        method: 'POST',
        url: '/api/auth/register',
        body: {
          name: 'Duplicate John',
          email: testEmail,
          password: 'Password@12345',
          confirmPassword: 'Password@12345'
        }
      });

      assert.equal(res.status, 409);
      assert.equal(res.data.code, 'DUPLICATE_EMAIL');
    });

    it('should reject registration if password is shorter than 10 characters (422 Unprocessable Entity)', async () => {
      const res = await request({
        method: 'POST',
        url: '/api/auth/register',
        body: {
          name: 'Short Password User',
          email: `short_${Date.now()}@testlnmiit.ac.in`,
          password: 'Short99',
          confirmPassword: 'Short99'
        }
      });

      assert.equal(res.status, 422);
      assert.equal(res.data.code, 'VALIDATION_FAILED');
      assert.ok(res.data.message.includes('10'), 'Validation message must mention at least 10 characters');
    });

    it('should reject registration if password and confirm password do not match (422)', async () => {
      const res = await request({
        method: 'POST',
        url: '/api/auth/register',
        body: {
          name: 'Mismatch User',
          email: `mismatch_${Date.now()}@testlnmiit.ac.in`,
          password: 'Password@12345',
          confirmPassword: 'Password@54321'
        }
      });

      assert.equal(res.status, 422);
      assert.equal(res.data.code, 'VALIDATION_FAILED');
    });

    it('should reject registration with invalid email format (422)', async () => {
      const res = await request({
        method: 'POST',
        url: '/api/auth/register',
        body: {
          name: 'Invalid Email User',
          email: 'invalid-email-address',
          password: 'Password@12345',
          confirmPassword: 'Password@12345'
        }
      });

      assert.equal(res.status, 422);
      assert.equal(res.data.code, 'VALIDATION_FAILED');
    });

    it('should prevent privilege escalation if client attempts to supply a privileged role', async () => {
      const escalatedEmail = `hacker_${Date.now()}@testlnmiit.ac.in`;
      const res = await request({
        method: 'POST',
        url: '/api/auth/register',
        body: {
          name: 'Exploit Tester',
          email: escalatedEmail,
          password: 'Password@12345',
          confirmPassword: 'Password@12345',
          role: 'ADMINISTRATOR' // attempt to escalate
        }
      });

      assert.equal(res.status, 201);
      assert.equal(res.data.user.role, 'APPLICANT', 'Server must ignore supplied role and enforce APPLICANT');
    });
  });

  describe('FR-002, FR-003, FR-004: User Authentication & Login', () => {
    it('should authenticate successfully with seeded applicant credentials', async () => {
      const res = await request({
        method: 'POST',
        url: '/api/auth/login',
        body: CREDENTIALS.APPLICANT
      });

      assert.equal(res.status, 200);
      assert.ok(res.data.token, 'Should return session token');
      assert.equal(res.data.role, 'APPLICANT');
      assert.equal(res.data.email, CREDENTIALS.APPLICANT.email);
      assert.ok(!res.data.passwordHash, 'Must never expose passwordHash');
    });

    it('should authenticate all institutional roles (Recruiter, Panel, HOD, Admin)', async () => {
      const roles = ['RECRUITMENT_CELL', 'INTERVIEW_PANEL_1', 'HOD_CSE', 'ADMINISTRATOR'];
      for (const roleKey of roles) {
        const res = await request({
          method: 'POST',
          url: '/api/auth/login',
          body: CREDENTIALS[roleKey]
        });
        assert.equal(res.status, 200, `Login should succeed for ${roleKey}`);
        assert.ok(res.data.token);
      }
    });

    it('should reject login with wrong password without revealing details (FR-004, 401 Unauthorized)', async () => {
      const res = await request({
        method: 'POST',
        url: '/api/auth/login',
        body: {
          email: CREDENTIALS.APPLICANT.email,
          password: 'WrongPassword@999'
        }
      });

      assert.equal(res.status, 401);
      assert.equal(res.data.code, 'AUTH_FAILED');
      assert.equal(res.data.message, 'Invalid email or password. Please try again.');
    });

    it('should reject login for non-existent email with generic message (FR-004, 401 Unauthorized)', async () => {
      const res = await request({
        method: 'POST',
        url: '/api/auth/login',
        body: {
          email: 'does_not_exist@lnmiit.ac.in',
          password: 'AnyPassword@123'
        }
      });

      assert.equal(res.status, 401);
      assert.equal(res.data.code, 'AUTH_FAILED');
      assert.equal(res.data.message, 'Invalid email or password. Please try again.');
    });

    it('should reject login request with missing credentials (401)', async () => {
      const res = await request({
        method: 'POST',
        url: '/api/auth/login',
        body: { email: '' }
      });

      assert.equal(res.status, 401);
    });
  });

  describe('FR-005: Logout & Session Termination', () => {
    it('should terminate active session on logout and invalidate future requests', async () => {
      // 1. Login
      const loginRes = await request({
        method: 'POST',
        url: '/api/auth/login',
        body: CREDENTIALS.APPLICANT
      });
      assert.equal(loginRes.status, 200);
      const token = loginRes.data.token;

      // 2. Check /api/auth/me is valid
      const meRes = await request({
        method: 'GET',
        url: '/api/auth/me',
        token
      });
      assert.equal(meRes.status, 200);
      assert.equal(meRes.data.email, CREDENTIALS.APPLICANT.email);

      // 3. Logout
      const logoutRes = await request({
        method: 'POST',
        url: '/api/auth/logout',
        token
      });
      assert.equal(logoutRes.status, 200);

      // 4. Invalidate future requests with this token
      const retryRes = await request({
        method: 'GET',
        url: '/api/auth/me',
        token
      });
      assert.equal(retryRes.status, 401, 'Token must be invalidated server-side');
    });

    it('should reject requests with fabricated or missing tokens (401)', async () => {
      const noTokenRes = await request({
        method: 'GET',
        url: '/api/auth/me'
      });
      assert.equal(noTokenRes.status, 401);

      const fakeTokenRes = await request({
        method: 'GET',
        url: '/api/auth/me',
        token: 'fake-token-1234567890abcdef'
      });
      assert.equal(fakeTokenRes.status, 401);
    });
  });
});
