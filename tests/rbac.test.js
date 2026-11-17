// Role-Based Access Control (RBAC) & Data Isolation Automated Test Suite
const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const { request, db, loginAs, CREDENTIALS } = require('./testHelper');

let applicantToken;
let secondApplicantToken;
let recruiterToken;
let panelToken;
let hodToken;
let adminToken;

before(async () => {
  await db.init();
  await db.reset();

  // Obtain authentic session tokens for each persona
  const applicantAuth = await loginAs('APPLICANT');
  applicantToken = applicantAuth.token;

  const recruiterAuth = await loginAs('RECRUITMENT_CELL');
  recruiterToken = recruiterAuth.token;

  const panelAuth = await loginAs('INTERVIEW_PANEL_1');
  panelToken = panelAuth.token;

  const hodAuth = await loginAs('HOD_CSE');
  hodToken = hodAuth.token;

  const adminAuth = await loginAs('ADMINISTRATOR');
  adminToken = adminAuth.token;

  // Register or login a second distinct applicant (Priya Mehta)
  const loginPriya = await request({
    method: 'POST',
    url: '/api/auth/login',
    body: { email: 'priya.mehta@example.com', password: 'Applicant@123' }
  });
  if (loginPriya.status === 200) {
    secondApplicantToken = loginPriya.data.token;
  } else {
    // If priya password wasn't default, register a second applicant
    const regRes = await request({
      method: 'POST',
      url: '/api/auth/register',
      body: {
        name: 'Dr. Second Candidate',
        email: 'second.applicant@example.com',
        password: 'Password@12345',
        confirmPassword: 'Password@12345'
      }
    });
    secondApplicantToken = regRes.data.token;
  }
});

describe('FR-006: Role-Based Authorization & Data Isolation Test Suite', () => {

  describe('Applicant Role Boundaries & Ownership Enforcement', () => {
    it('should allow applicant to view their own application (APP-0158 belongs to Rahul Sharma A102)', async () => {
      const res = await request({
        method: 'GET',
        url: '/api/applications/APP-0158',
        token: applicantToken
      });

      assert.equal(res.status, 200);
      const app = res.data.application || res.data;
      assert.equal(app.applicationId, 'APP-0158');
      assert.equal(app.applicantId, 'A102');
    });

    it('should forbid an applicant from viewing another applicant\'s application (403 Forbidden)', async () => {
      // APP-0161 belongs to A103 (Priya Mehta), Rahul Sharma (A102) must be forbidden
      const res = await request({
        method: 'GET',
        url: '/api/applications/APP-0161',
        token: applicantToken
      });

      assert.equal(res.status, 403);
      assert.equal(res.data.code, 'FORBIDDEN');
    });

    it('should forbid an applicant from saving a draft or editing another applicant\'s application', async () => {
      const res = await request({
        method: 'PUT',
        url: '/api/applications/APP-0161',
        token: applicantToken,
        body: { highestDegree: 'Tampered PhD' }
      });

      assert.equal(res.status, 403);
      assert.equal(res.data.code, 'FORBIDDEN');
    });

    it('should forbid an applicant from submitting another applicant\'s application', async () => {
      const res = await request({
        method: 'POST',
        url: '/api/applications/APP-0161/submit',
        token: applicantToken
      });

      assert.equal(res.status, 403);
      assert.equal(res.data.code, 'FORBIDDEN');
    });

    it('should forbid an applicant from accessing Recruitment Cell candidate screening list (403)', async () => {
      const res = await request({
        method: 'GET',
        url: '/api/rc/vacancies/FAC-CS-2026-01/applications',
        token: applicantToken
      });

      assert.equal(res.status, 403);
      assert.equal(res.data.code, 'FORBIDDEN');
    });

    it('should forbid an applicant from creating new vacancies (403)', async () => {
      const res = await request({
        method: 'POST',
        url: '/api/vacancies',
        token: applicantToken,
        body: {
          department: 'Computer Science',
          designation: 'Professor'
        }
      });

      assert.equal(res.status, 403);
      assert.equal(res.data.code, 'FORBIDDEN');
    });

    it('should forbid an applicant from accessing Interview Panel evaluation endpoints (403)', async () => {
      const res = await request({
        method: 'GET',
        url: '/api/panel/interviews',
        token: applicantToken
      });

      assert.equal(res.status, 403);
      assert.equal(res.data.code, 'FORBIDDEN');
    });

    it('should forbid an applicant from accessing HOD candidate review endpoints (403)', async () => {
      const res = await request({
        method: 'GET',
        url: '/api/hod/applications',
        token: applicantToken
      });

      assert.equal(res.status, 403);
      assert.equal(res.data.code, 'FORBIDDEN');
    });

    it('should forbid an applicant from viewing system audit logs (403)', async () => {
      const res = await request({
        method: 'GET',
        url: '/api/audit-logs',
        token: applicantToken
      });

      assert.equal(res.status, 403);
      assert.equal(res.data.code, 'FORBIDDEN');
    });
  });

  describe('Interview Panel Role Boundaries', () => {
    it('should allow panel member to view assigned interviews (S-09)', async () => {
      const res = await request({
        method: 'GET',
        url: '/api/panel/interviews',
        token: panelToken
      });

      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.data));
    });

    it('should forbid interview panel from making HOD departmental approval decisions (403)', async () => {
      const res = await request({
        method: 'POST',
        url: '/api/hod/applications/APP-0158/decision',
        token: panelToken,
        body: { decision: 'APPROVED', comments: 'Unauthorized bypass' }
      });

      assert.equal(res.status, 403);
      assert.equal(res.data.code, 'FORBIDDEN');
    });

    it('should forbid interview panel from generating appointment letters (403)', async () => {
      const res = await request({
        method: 'POST',
        url: '/api/rc/applications/APP-0158/appointment-letter',
        token: panelToken,
        body: { proposedSalary: 80000 }
      });

      assert.equal(res.status, 403);
      assert.equal(res.data.code, 'FORBIDDEN');
    });
  });

  describe('HOD Departmental Authorization Scope', () => {
    it('should allow HOD CSE to list shortlisted applications for CSE department', async () => {
      const res = await request({
        method: 'GET',
        url: '/api/hod/applications',
        token: hodToken
      });

      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.data));
    });

    it('should forbid HOD CSE from reviewing/approving applications of another department (403)', async () => {
      // Create an application under an ECE vacancy
      const eceAppId = 'APP-ECE-TEST-01';
      db.data.applications.push({
        applicationId: eceAppId,
        applicantId: 'A999',
        applicantName: 'ECE Applicant',
        vacancyId: 'FAC-EC-2026-03', // Electronics & Communication
        status: 'INTERVIEW_COMPLETED',
        hodReview: { reviewed: false, approved: null }
      });
      db.save();

      const res = await request({
        method: 'POST',
        url: `/api/hod/applications/${eceAppId}/decision`,
        token: hodToken,
        body: { decision: 'APPROVED', comments: 'HOD CSE crossing department lines' }
      });

      assert.equal(res.status, 403);
      assert.equal(res.data.code, 'FORBIDDEN');
      assert.ok(res.data.message.toLowerCase().includes('department'));
    });
  });

  describe('Administrator Elevated Scope', () => {
    it('should allow administrator to access system audit logs', async () => {
      const res = await request({
        method: 'GET',
        url: '/api/audit-logs',
        token: adminToken
      });

      assert.equal(res.status, 200);
      assert.ok(Array.isArray(res.data));
    });

    it('should allow administrator to access any application for oversight', async () => {
      const res = await request({
        method: 'GET',
        url: '/api/applications/APP-0158',
        token: adminToken
      });

      assert.equal(res.status, 200);
      const app = res.data.application || res.data;
      assert.equal(app.applicationId, 'APP-0158');
    });
  });
});
