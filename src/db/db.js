// Persistent Database Layer with Atomic Disk Writes & Relational SQL Backend
const fs = require('fs');
const path = require('path');
const config = require('../config');
const { generateSeedData } = require('./seed');
const relationalDb = require('./relationalDb');

class Database {
  constructor() {
    this.data = null;
    this.initialized = false;
    this.initPromise = null;
    this.relational = relationalDb;
  }

  async init() {
    if (this.initialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = (async () => {
      // Ensure data directory exists
      if (!fs.existsSync(config.DATA_DIR)) {
        fs.mkdirSync(config.DATA_DIR, { recursive: true });
      }

      // Ensure storage directory exists
      if (!fs.existsSync(config.STORAGE_DIR)) {
        fs.mkdirSync(config.STORAGE_DIR, { recursive: true });
      }

      // Check if persistent database file exists
      if (fs.existsSync(config.DB_FILE)) {
        try {
          const raw = fs.readFileSync(config.DB_FILE, 'utf8');
          this.data = JSON.parse(raw);
          // Ensure sessions array exists
          if (!this.data.sessions) this.data.sessions = [];
          if (!this.data.uploadedFiles) this.data.uploadedFiles = [];
          this.initialized = true;
          this.syncToRelationalDb();
          return;
        } catch (err) {
          console.error("Failed to read database file, reinitializing from seed:", err);
        }
      }

      // If no file exists or parse failed, initialize from seed
      this.data = await generateSeedData();
      this.saveSync();
      this.syncToRelationalDb();
      this.initialized = true;
    })();

    return this.initPromise;
  }

  // Atomic file save to prevent data corruption
  saveSync() {
    if (!this.data) return;
    const jsonStr = JSON.stringify(this.data, null, 2);
    const tmpFile = `${config.DB_FILE}.${process.pid}.${Date.now()}.${Math.random().toString(36).substring(2, 7)}.tmp`;
    try {
      fs.writeFileSync(tmpFile, jsonStr, 'utf8');
      fs.renameSync(tmpFile, config.DB_FILE);
    } catch (err) {
      try {
        fs.writeFileSync(config.DB_FILE, jsonStr, 'utf8');
      } catch (fallbackErr) {
        console.error("Failed to persist database to disk:", fallbackErr);
      }
      try {
        if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
      } catch (e) {}
    }
    this.syncToRelationalDb();
  }

  save() {
    this.saveSync();
  }

  async reset() {
    this.data = await generateSeedData();
    this.saveSync();
    this.syncToRelationalDb();
    return this.data;
  }

  // Synchronize in-memory collections into 18 Relational SQL Tables
  syncToRelationalDb() {
    if (!this.data) return;
    try {
      relationalDb.init();

      // 1. Users
      for (const u of (this.data.users || [])) {
        relationalDb.insert('users', {
          user_id: u.userId,
          name: u.name,
          email: u.email,
          password_hash: u.passwordHash,
          role: u.role,
          active: u.active !== false,
          applicant_id: u.applicantId || null,
          employee_id: u.employeeId || null,
          member_id: u.memberId || null,
          hod_id: u.hodId || null,
          department: u.department || null,
          phone: u.phone || null,
          created_at: u.createdAt || new Date().toISOString()
        });
      }

      // 2. Sessions
      for (const s of (this.data.sessions || [])) {
        relationalDb.insert('sessions', {
          session_id: s.sessionId,
          token: s.token,
          user_id: s.userId,
          role: s.role,
          applicant_id: s.applicantId || null,
          employee_id: s.employeeId || null,
          member_id: s.memberId || null,
          hod_id: s.hodId || null,
          department: s.department || null,
          created_at: s.createdAt,
          expires_at: s.expiresAt
        });
      }

      // 3. Applicant Profiles, Addresses, Education, Experience, Research Papers
      for (const [appId, p] of Object.entries(this.data.applicantProfiles || {})) {
        relationalDb.insert('applicant_profiles', {
          profile_id: p.profileId || `P-${appId}`,
          applicant_id: appId,
          user_id: p.userId || null,
          date_of_birth: p.dateOfBirth || null,
          phone: p.phone || null,
          willingness_to_relocate: p.willingnessToRelocate !== false,
          has_disability: p.hasDisability === true,
          disability_type: p.disabilityType || null,
          current_plot_building: p.currentAddress ? p.currentAddress.plotBuilding : null,
          current_locality: p.currentAddress ? p.currentAddress.locality : null,
          current_city: p.currentAddress ? p.currentAddress.city : null,
          current_state: p.currentAddress ? p.currentAddress.state : null,
          current_pincode: p.currentAddress ? p.currentAddress.pincode : null,
          permanent_plot_building: p.permanentAddress ? p.permanentAddress.plotBuilding : null,
          permanent_locality: p.permanentAddress ? p.permanentAddress.locality : null,
          permanent_city: p.permanentAddress ? p.permanentAddress.city : null,
          permanent_state: p.permanentAddress ? p.permanentAddress.state : null,
          permanent_pincode: p.permanentAddress ? p.permanentAddress.pincode : null
        });

        for (const edu of (p.education || [])) {
          relationalDb.insert('educations', {
            education_id: edu.educationId || `EDU-${Math.random().toString(36).slice(2, 7)}`,
            applicant_id: appId,
            degree: edu.degree,
            field_of_study: edu.fieldOfStudy,
            institute: edu.institute,
            grade: edu.grade,
            start_year: edu.startYear,
            end_year: edu.endYear
          });
        }

        for (const exp of (p.experience || [])) {
          relationalDb.insert('experiences', {
            experience_id: exp.experienceId || `EXP-${Math.random().toString(36).slice(2, 7)}`,
            applicant_id: appId,
            organization: exp.organization,
            position: exp.position,
            start_year: exp.startYear,
            end_year: exp.endYear,
            total_experience: exp.totalExperience || 0
          });
        }

        for (const paper of (p.researchPapers || [])) {
          relationalDb.insert('research_papers', {
            paper_id: paper.paperId || `PUB-${Math.random().toString(36).slice(2, 7)}`,
            applicant_id: appId,
            title: paper.title,
            year_of_publication: paper.year,
            journal_or_conference: paper.journal || paper.conference || null
          });
        }
      }

      // 4. Vacancies & Eligibility Criteria
      for (const v of (this.data.vacancies || [])) {
        relationalDb.insert('vacancies', {
          vacancy_id: v.vacancyId,
          department: v.department,
          specialization: v.specialization,
          designation: v.designation,
          academic_level: v.academicLevel || 'Level 10',
          notes: v.notes || null,
          education_eligibility: v.educationEligibility,
          experience_eligibility: v.experienceEligibility,
          compensation: v.compensation,
          benefits: v.benefits,
          incentives: v.incentives,
          nature_of_position: v.natureOfPosition || 'Full-time, Regular',
          location: v.location || 'LNMIIT Campus, Jaipur',
          teaching_responsibilities: v.teachingResponsibilities || null,
          opening_date: v.openingDate,
          closing_date: v.closingDate,
          status: v.status || 'PUBLISHED',
          created_by: v.createdBy || 'U007'
        });

        if (v.criteria) {
          relationalDb.insert('eligibility_criteria', {
            criteria_id: v.criteria.criteriaId || `CRIT-${v.vacancyId}`,
            vacancy_id: v.vacancyId,
            education_requirement: v.criteria.educationRequirement,
            min_experience_years: v.criteria.minExperienceYears || 0,
            other_requirements: v.criteria.otherRequirements || null
          });
        }
      }

      // 5. Applications & Documents & Screenings
      for (const a of (this.data.applications || [])) {
        relationalDb.insert('applications', {
          application_id: a.applicationId,
          applicant_id: a.applicantId,
          applicant_name: a.applicantName,
          applicant_email: a.applicantEmail,
          vacancy_id: a.vacancyId,
          application_date: a.applicationDate,
          submission_date: a.submissionDate || null,
          status: a.status,
          highest_degree: a.highestDegree || null,
          total_experience: a.totalExperience || 0,
          interview_id: a.interviewId || null
        });

        for (const d of (a.documents || [])) {
          relationalDb.insert('documents', {
            document_id: d.documentId,
            application_id: a.applicationId,
            document_type: d.documentType,
            file_name: d.fileName,
            storage_path: d.storagePath || '',
            file_size_kb: d.fileSizeKB || 1,
            mime_type: d.mimeType || 'application/pdf',
            upload_date: d.uploadDate || new Date().toISOString(),
            verification_status: d.verificationStatus || 'PENDING'
          });
        }

        if (a.screeningRecord) {
          relationalDb.insert('screening_records', {
            screening_id: a.screeningRecord.screeningId || `SCR-${a.applicationId}`,
            application_id: a.applicationId,
            screened_by: a.screeningRecord.screenedBy,
            result: a.screeningRecord.result,
            comments: a.screeningRecord.comments || null,
            screening_date: a.screeningRecord.screeningDate || new Date().toISOString()
          });
        }

        if (a.hodReview && a.hodReview.reviewed) {
          relationalDb.insert('hod_reviews', {
            review_id: `HOD-${a.applicationId}`,
            application_id: a.applicationId,
            hod_id: a.hodReview.hodId || 'U001',
            decision: a.hodReview.decision || (a.hodReview.approved ? 'APPROVED' : 'REJECTED'),
            comments: a.hodReview.comments || null,
            decision_date: a.hodReview.decisionDate || new Date().toISOString()
          });
        }

        if (a.appointmentLetter) {
          relationalDb.insert('appointment_letters', {
            letter_id: `APPT-${a.applicationId}`,
            application_id: a.applicationId,
            reference_no: a.appointmentLetter.referenceNo,
            issue_date: a.appointmentLetter.issueDate,
            candidate_name: a.appointmentLetter.candidateName,
            position: a.appointmentLetter.position,
            department: a.appointmentLetter.department,
            academic_level: a.appointmentLetter.academicLevel,
            basic_pay: a.appointmentLetter.basicPay,
            reporting_date: a.appointmentLetter.reportingDate,
            issued_by: a.appointmentLetter.issuedBy
          });
        }
      }

      // 6. Interviews & Evaluations
      for (const iv of (this.data.interviews || [])) {
        relationalDb.insert('interviews', {
          interview_id: iv.interviewId,
          application_id: iv.applicationId,
          vacancy_id: iv.vacancyId,
          candidate_name: iv.candidateName,
          interview_date: iv.interviewDate,
          interview_time: iv.interviewTime,
          status: iv.status,
          aggregate_score: iv.aggregateScore || null,
          recommendation: iv.recommendation || 'PENDING',
          panel_remarks: iv.panelRemarks || null,
          finalized: iv.finalized === true
        });

        for (const p of (iv.panel || [])) {
          relationalDb.insert('interview_panel', {
            id: `${iv.interviewId}_${p.memberId}`,
            interview_id: iv.interviewId,
            member_id: p.memberId,
            member_name: p.name,
            designation: p.designation,
            department: p.department || null,
            attended: iv.attendance ? (iv.attendance[p.memberId] === true) : true
          });
        }

        for (const ev of (iv.evaluations || [])) {
          relationalDb.insert('evaluations', {
            evaluation_id: ev.evaluationId,
            interview_id: iv.interviewId,
            member_id: ev.memberId,
            member_name: ev.memberName,
            score: ev.score,
            comments: ev.comments,
            evaluation_date: ev.evaluationDate
          });
        }
      }

      // 7. Notifications
      for (const n of (this.data.notifications || [])) {
        relationalDb.insert('notifications', {
          notification_id: n.notificationId,
          recipient_id: n.recipientId,
          notification_type: n.type || n.notificationType,
          message: n.message,
          timestamp: n.timestamp || n.createdAt || new Date().toISOString(),
          status: n.status || (n.read ? 'READ' : 'SENT')
        });
      }

      // 8. Audit Logs
      for (const l of (this.data.auditLogs || [])) {
        relationalDb.insert('audit_logs', {
          log_id: l.logId,
          user_id: l.userId,
          action: l.action,
          entity_type: l.entityType,
          entity_id: l.entityId,
          timestamp: l.timestamp
        });
      }

      relationalDb.persist();
    } catch (err) {
      console.error("Relational DB sync error:", err);
    }
  }

  // --- Users ---
  findUserByEmail(email) {
    if (!email || !this.data) return null;
    return this.data.users.find(u => u.email.toLowerCase() === email.trim().toLowerCase()) || null;
  }

  findUserById(userId) {
    if (!userId || !this.data) return null;
    return this.data.users.find(u => u.userId === userId) || null;
  }

  addUser(user) {
    this.data.users.push(user);
    this.save();
    return user;
  }

  updateUser(userId, updates) {
    const user = this.findUserById(userId);
    if (!user) return null;
    Object.assign(user, updates);
    this.save();
    return user;
  }

  // --- Sessions ---
  createSession(session) {
    if (!this.data.sessions) this.data.sessions = [];
    this.data.sessions.push(session);
    this.save();
    return session;
  }

  findSession(token) {
    if (!token || !this.data.sessions) return null;
    return this.data.sessions.find(s => s.token === token) || null;
  }

  deleteSession(token) {
    if (!this.data.sessions) return;
    const initialLen = this.data.sessions.length;
    this.data.sessions = this.data.sessions.filter(s => s.token !== token);
    if (this.data.sessions.length !== initialLen) {
      this.save();
    }
  }

  cleanExpiredSessions() {
    if (!this.data.sessions) return;
    const now = new Date();
    const active = this.data.sessions.filter(s => new Date(s.expiresAt) > now);
    if (active.length !== this.data.sessions.length) {
      this.data.sessions = active;
      this.save();
    }
  }

  // --- Vacancies ---
  getVacancies(filters = {}) {
    let list = this.data.vacancies || [];
    if (filters.dept && filters.dept !== 'All') {
      list = list.filter(v => v.department.toLowerCase() === filters.dept.toLowerCase());
    }
    if (filters.designation && filters.designation !== 'All') {
      list = list.filter(v => v.designation.toLowerCase() === filters.designation.toLowerCase());
    }
    if (filters.q) {
      const q = filters.q.toLowerCase();
      list = list.filter(v =>
        v.vacancyId.toLowerCase().includes(q) ||
        v.specialization.toLowerCase().includes(q) ||
        v.department.toLowerCase().includes(q)
      );
    }
    return list;
  }

  getVacancy(vacancyId) {
    if (!this.data.vacancies) return null;
    return this.data.vacancies.find(v => v.vacancyId === vacancyId) || null;
  }

  addVacancy(vacancy) {
    this.data.vacancies.unshift(vacancy);
    this.save();
    return vacancy;
  }

  // --- Applicant Profiles ---
  getApplicantProfile(applicantId) {
    if (!this.data.applicantProfiles) return null;
    return this.data.applicantProfiles[applicantId] || null;
  }

  saveApplicantProfile(applicantId, profileData) {
    if (!this.data.applicantProfiles) this.data.applicantProfiles = {};
    this.data.applicantProfiles[applicantId] = {
      ...(this.data.applicantProfiles[applicantId] || { profileId: `P-${applicantId}`, applicantId }),
      ...profileData
    };
    this.save();
    return this.data.applicantProfiles[applicantId];
  }

  // --- Applications ---
  getApplication(applicationId) {
    if (!this.data.applications) return null;
    return this.data.applications.find(a => a.applicationId === applicationId) || null;
  }

  getApplicationsByApplicant(applicantId) {
    if (!this.data.applications) return [];
    return this.data.applications.filter(a => a.applicantId === applicantId);
  }

  getApplicationsByVacancy(vacancyId) {
    if (!this.data.applications) return [];
    return this.data.applications.filter(a => a.vacancyId === vacancyId);
  }

  addApplication(application) {
    this.data.applications.push(application);
    this.save();
    return application;
  }

  updateApplication(applicationId, updates) {
    const app = this.getApplication(applicationId);
    if (!app) return null;
    Object.assign(app, updates);
    this.save();
    return app;
  }

  // --- Documents / Files ---
  getUploadedFile(fileId) {
    if (!this.data.uploadedFiles) return null;
    return this.data.uploadedFiles.find(f => f.fileId === fileId) || null;
  }

  addUploadedFile(fileRecord) {
    if (!this.data.uploadedFiles) this.data.uploadedFiles = [];
    this.data.uploadedFiles.push(fileRecord);
    this.save();
    return fileRecord;
  }

  // --- Interviews ---
  getInterview(interviewId) {
    if (!this.data.interviews) return null;
    return this.data.interviews.find(iv => iv.interviewId === interviewId) || null;
  }

  getAssignedInterviews(memberId) {
    if (!this.data.interviews) return [];
    return this.data.interviews.filter(iv =>
      iv.panel && iv.panel.some(p => p.memberId === memberId)
    );
  }

  updateInterview(interviewId, updates) {
    const iv = this.getInterview(interviewId);
    if (!iv) return null;
    Object.assign(iv, updates);
    this.save();
    return iv;
  }

  // --- Notifications ---
  addNotification(notification) {
    if (!this.data.notifications) this.data.notifications = [];
    this.data.notifications.unshift(notification);
    this.save();
    return notification;
  }

  getNotifications(userId) {
    if (!this.data.notifications) return [];
    return this.data.notifications.filter(n => n.recipientId === userId || n.recipientId === 'ALL');
  }

  // --- Audit Logs ---
  addAuditLog(entry) {
    if (!this.data.auditLogs) this.data.auditLogs = [];
    this.data.auditLogs.unshift(entry);
    this.save();
    return entry;
  }

  getAuditLogs() {
    return this.data.auditLogs || [];
  }

  // --- Reset to seed data ---
  async reset() {
    this.data = await generateSeedData();
    this.saveSync();
    this.initialized = true;
    return this.data;
  }
}

const db = new Database();

module.exports = db;
