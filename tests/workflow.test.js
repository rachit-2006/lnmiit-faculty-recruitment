// Recruitment Workflow State Machine & Validation Automated Test Suite
const { describe, it, before } = require('node:test');
const assert = require('node:assert/strict');
const { request, db, loginAs, CREDENTIALS } = require('./testHelper');

let applicantToken;
let recruiterToken;
let panelToken;
let hodToken;

before(async () => {
  await db.init();
  await db.reset();

  const appAuth = await loginAs('APPLICANT');
  applicantToken = appAuth.token;

  const rcAuth = await loginAs('RECRUITMENT_CELL');
  recruiterToken = rcAuth.token;

  const pnlAuth = await loginAs('INTERVIEW_PANEL_1');
  panelToken = pnlAuth.token;

  const hAuth = await loginAs('HOD_CSE');
  hodToken = hAuth.token;
});

describe('Recruitment Workflow & State Machine Test Suite', () => {

  describe('Application Initiation & BR-003 Duplicate Application Prevention', () => {
    it('should create a new draft application for an open vacancy', async () => {
      // FAC-EC-2026-03 is an open vacancy
      const reg = await request({
        method: 'POST',
        url: '/api/auth/register',
        body: {
          name: 'Dr. New Applicant',
          email: `workflow_cand_${Date.now()}@example.com`,
          password: 'Password@12345',
          confirmPassword: 'Password@12345'
        }
      });
      assert.equal(reg.status, 201);
      const candToken = reg.data.token;

      const res = await request({
        method: 'POST',
        url: '/api/vacancies/FAC-EC-2026-03/applications',
        token: candToken
      });

      assert.equal(res.status, 201);
      assert.ok(res.data.applicationId);
      assert.equal(res.data.status, 'DRAFT');
    });

    it('should reject duplicate application for already submitted vacancy (409 Conflict)', async () => {
      // Register dedicated candidate for duplicity test
      const reg2 = await request({
        method: 'POST',
        url: '/api/auth/register',
        body: {
          name: 'Dr. Dupe Candidate',
          email: `dupe_cand_${Date.now()}@example.com`,
          password: 'Password@12345',
          confirmPassword: 'Password@12345'
        }
      });
      const dupeCandToken = reg2.data.token;

      // 1. Create first application
      const firstRes = await request({
        method: 'POST',
        url: '/api/vacancies/FAC-EC-2026-03/applications',
        token: dupeCandToken
      });
      assert.equal(firstRes.status, 201);
      const appId = firstRes.data.applicationId;

      // 2. Attach required documents and submit
      const validPdfBase64 = Buffer.from('%PDF-1.4\n%Academic Document\n%%EOF').toString('base64');
      const docs = ['AADHAR_CARD', 'MASTERS_DEGREE', 'EXPERIENCE_CERTIFICATE', 'MARKSHEET_10', 'BIRTH_CERTIFICATE'];
      for (const dt of docs) {
        await request({
          method: 'POST',
          url: `/api/applications/${appId}/documents`,
          token: dupeCandToken,
          body: {
            documentType: dt,
            fileName: `${dt.toLowerCase()}.pdf`,
            mimeType: 'application/pdf',
            fileData: validPdfBase64
          }
        });
      }

      const submitRes = await request({
        method: 'POST',
        url: `/api/applications/${appId}/submit`,
        token: dupeCandToken
      });
      assert.equal(submitRes.status, 200);

      // 3. Second application attempt for same vacancy must be rejected
      const secondRes = await request({
        method: 'POST',
        url: '/api/vacancies/FAC-EC-2026-03/applications',
        token: dupeCandToken
      });

      assert.equal(secondRes.status, 409);
      assert.equal(secondRes.data.code, 'DUPLICATE_APPLICATION');
    });
  });

  describe('Document Upload & Magic-Byte Verification', () => {
    let testDraftAppId;
    let candToken;

    before(async () => {
      // Register dedicated applicant and start a draft application
      const reg = await request({
        method: 'POST',
        url: '/api/auth/register',
        body: {
          name: 'Dr. Doc Tester',
          email: `doc_cand_${Date.now()}@example.com`,
          password: 'Password@12345',
          confirmPassword: 'Password@12345'
        }
      });
      candToken = reg.data.token;

      const appRes = await request({
        method: 'POST',
        url: '/api/vacancies/FAC-EC-2026-03/applications',
        token: candToken
      });
      testDraftAppId = appRes.data.applicationId;
    });

    it('should reject file upload when magic bytes do not match declared extension (422)', async () => {
      // Send a base64 encoded string that has .pdf extension but invalid header (not %PDF)
      const fakePdfData = Buffer.from('NOT_A_REAL_PDF_JUST_PLAIN_TEXT_CONTENT_1234567890').toString('base64');
      const res = await request({
        method: 'POST',
        url: `/api/applications/${testDraftAppId}/documents`,
        token: candToken,
        body: {
          documentType: 'AADHAR_CARD',
          fileName: 'fake_document.pdf',
          mimeType: 'application/pdf',
          fileData: fakePdfData
        }
      });

      assert.equal(res.status, 422);
      assert.equal(res.data.code, 'INVALID_DOCUMENT');
      assert.ok(res.data.message.includes('declared format'));
    });

    it('should accept valid PDF file with genuine %PDF magic bytes', async () => {
      const validPdfData = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Title (Test CV) >>\nendobj\n%%EOF').toString('base64');
      const res = await request({
        method: 'POST',
        url: `/api/applications/${testDraftAppId}/documents`,
        token: candToken,
        body: {
          documentType: 'AADHAR_CARD',
          fileName: 'valid_aadhar.pdf',
          mimeType: 'application/pdf',
          fileData: validPdfData
        }
      });

      assert.equal(res.status, 201);
      assert.ok(res.data.documentId);
      assert.equal(res.data.documentType, 'AADHAR_CARD');
    });
  });

  describe('Application Submission & Mandatory Document Checks', () => {
    let incompleteAppId;
    let candToken;

    before(async () => {
      const reg = await request({
        method: 'POST',
        url: '/api/auth/register',
        body: {
          name: 'Dr. Submit Tester',
          email: `sub_cand_${Date.now()}@example.com`,
          password: 'Password@12345',
          confirmPassword: 'Password@12345'
        }
      });
      candToken = reg.data.token;

      const appRes = await request({
        method: 'POST',
        url: '/api/vacancies/FAC-EC-2026-03/applications',
        token: candToken
      });
      incompleteAppId = appRes.data.applicationId;
    });

    it('should reject application submission when mandatory documents are missing (422 Unprocessable Entity)', async () => {
      const res = await request({
        method: 'POST',
        url: `/api/applications/${incompleteAppId}/submit`,
        token: candToken
      });

      assert.equal(res.status, 422);
      assert.equal(res.data.code, 'MISSING_DOCUMENTS');
      assert.ok(res.data.message.includes('mandatory documents'));
    });

    it('should successfully submit application once all mandatory documents are attached', async () => {
      const mandatoryDocs = [
        'AADHAR_CARD',
        'MASTERS_DEGREE',
        'EXPERIENCE_CERTIFICATE',
        'MARKSHEET_10',
        'BIRTH_CERTIFICATE'
      ];

      const validPdfBase64 = Buffer.from('%PDF-1.4\n%Academic Document\n%%EOF').toString('base64');

      for (const docType of mandatoryDocs) {
        const upRes = await request({
          method: 'POST',
          url: `/api/applications/${incompleteAppId}/documents`,
          token: candToken,
          body: {
            documentType: docType,
            fileName: `${docType.toLowerCase()}.pdf`,
            mimeType: 'application/pdf',
            fileData: validPdfBase64
          }
        });
        assert.equal(upRes.status, 201);
      }

      // Now submit
      const submitRes = await request({
        method: 'POST',
        url: `/api/applications/${incompleteAppId}/submit`,
        token: candToken
      });

      assert.equal(submitRes.status, 200);
      assert.equal(submitRes.data.status, 'SUBMITTED');
    });
  });

  describe('Invalid State Transition Protection', () => {
    it('should forbid generating appointment letter before HOD approval (409 Conflict)', async () => {
      // APP-0158 status is currently ELIGIBLE or NOT approved by HOD
      const res = await request({
        method: 'POST',
        url: '/api/rc/applications/APP-0158/appointment-letter',
        token: recruiterToken
      });

      assert.equal(res.status, 409);
      assert.equal(res.data.code, 'INVALID_STATE_TRANSITION');
      assert.ok(res.data.message.includes('before HOD approval'));
    });

    it('should forbid HOD approval before interview panel completes recommendation (409 Conflict)', async () => {
      // APP-0161 is still pending panel evaluation
      const res = await request({
        method: 'POST',
        url: '/api/hod/applications/APP-0161/decision',
        token: hodToken,
        body: { decision: 'APPROVED', comments: 'Early approval attempt' }
      });

      assert.equal(res.status, 409);
      assert.equal(res.data.code, 'INVALID_STATE_TRANSITION');
    });
  });

  describe('Interview Panel Evaluation & Score Range Validation', () => {
    it('should reject evaluation score greater than 10 (422 Unprocessable Entity)', async () => {
      const res = await request({
        method: 'POST',
        url: '/api/panel/interviews/INT-032/evaluations',
        token: panelToken,
        body: {
          score: 15.0,
          comments: 'Candidate was extraordinary but score is out of range'
        }
      });

      assert.equal(res.status, 422);
      assert.equal(res.data.code, 'SCORE_OUT_OF_RANGE');
    });

    it('should reject evaluation score less than 0 (422 Unprocessable Entity)', async () => {
      const res = await request({
        method: 'POST',
        url: '/api/panel/interviews/INT-032/evaluations',
        token: panelToken,
        body: {
          score: -1.0,
          comments: 'Invalid negative score'
        }
      });

      assert.equal(res.status, 422);
      assert.equal(res.data.code, 'SCORE_OUT_OF_RANGE');
    });

    it('should reject evaluation submission when comments are omitted (422)', async () => {
      const res = await request({
        method: 'POST',
        url: '/api/panel/interviews/INT-032/evaluations',
        token: panelToken,
        body: {
          score: 8.5,
          comments: ''
        }
      });

      assert.equal(res.status, 422);
      assert.equal(res.data.code, 'INCOMPLETE_EVALUATION');
    });

    it('should record valid panel evaluation (score 0-10 with comments)', async () => {
      const res = await request({
        method: 'POST',
        url: '/api/panel/interviews/INT-032/evaluations',
        token: panelToken,
        body: {
          score: 8.5,
          comments: 'Solid grasp of data structures and distributed computing systems.'
        }
      });

      assert.equal(res.status, 201);
      assert.ok(res.data.evaluationId);
    });
  });

  describe('End-to-End Recruitment Cycle: Panel Recommendation -> HOD Approval -> Appointment Letter', () => {
    it('should finalize interview panel recommendation to SHORTLIST candidate', async () => {
      // INT-031 is in VALIDATED status, ready for recommendation
      const res = await request({
        method: 'POST',
        url: '/api/panel/interviews/INT-031/recommendation',
        token: panelToken,
        body: {
          recommendation: 'RECOMMENDED',
          remarks: 'Highly recommended for Assistant Professor in Computer Science'
        }
      });

      assert.equal(res.status, 200);
      assert.equal(res.data.recommendation, 'RECOMMENDED');

      // Verify that APP-0158 is now SHORTLISTED
      const app = db.getApplication('APP-0158');
      assert.equal(app.status, 'SHORTLISTED');
    });

    it('should record HOD approval for shortlisted candidate', async () => {
      const res = await request({
        method: 'POST',
        url: '/api/hod/applications/APP-0158/decision',
        token: hodToken,
        body: {
          decision: 'APPROVED',
          comments: 'Approved appointment for Department of Computer Science.'
        }
      });

      assert.equal(res.status, 200);
      assert.equal(res.data.approved, true);

      // Verify that APP-0158 is now APPROVED_BY_HOD
      const app = db.getApplication('APP-0158');
      assert.equal(app.status, 'APPROVED_BY_HOD');
    });

    it('should generate official appointment letter by Recruitment Cell after HOD approval', async () => {
      const res = await request({
        method: 'POST',
        url: '/api/rc/applications/APP-0158/appointment-letter',
        token: recruiterToken
      });

      assert.equal(res.status, 201);
      assert.ok(res.data.referenceNo);
      assert.equal(res.data.candidateName, 'Rahul Sharma');
      assert.ok(res.data.basicPay);

      // Verify application state is now APPOINTED
      const app = db.getApplication('APP-0158');
      assert.equal(app.status, 'APPOINTED');
      assert.ok(app.appointmentLetter);
    });
  });
});
