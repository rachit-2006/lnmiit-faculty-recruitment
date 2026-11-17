// Core Domain Recruitment Workflow Service with Persistent Database Integration
const db = require('../db/db');
const {
  isValidApplicationTransition,
  isValidInterviewTransition,
  MANDATORY_DOCUMENTS
} = require('../stateMachine');
const { recordAuditLog } = require('./auditService');

class RecruitmentService {
  // --- Vacancies (S-02, S-03, UC-006) ---
  getVacancies(filters = {}) {
    return db.getVacancies(filters);
  }

  getVacancy(vacancyId) {
    return db.getVacancy(vacancyId);
  }

  isApplicationOpen(vacancyId) {
    const vacancy = this.getVacancy(vacancyId);
    if (!vacancy) return false;
    if (vacancy.status !== "PUBLISHED") return false;
    const now = new Date();
    const close = new Date(vacancy.closingDate);
    // Include the entire closing day
    close.setHours(23, 59, 59, 999);
    return now <= close;
  }

  createVacancy(data, userId = "U007") {
    const required = ['department', 'designation', 'specialization', 'closingDate'];
    for (const f of required) {
      if (!data[f] || !String(data[f]).trim()) {
        const err = new Error(`Field '${f}' is mandatory to list a vacancy.`);
        err.status = 400; err.code = "VALIDATION_FAILED";
        throw err;
      }
    }

    const openingDate = data.openingDate || new Date().toISOString().split('T')[0];
    const closingDate = data.closingDate;

    if (new Date(closingDate) < new Date(openingDate)) {
      const err = new Error("Application closing date cannot be before the opening date.");
      err.status = 400; err.code = "INVALID_DATES";
      throw err;
    }

    let vacancyId = data.vacancyId;
    if (!vacancyId || !String(vacancyId).trim()) {
      const deptCodeMap = {
        "Computer Science": "CS",
        "Electronics & Comm.": "EC",
        "Mechanical": "ME",
        "Mathematics": "MA",
        "Physics": "PH",
        "Humanities & Social Sciences": "HSS",
        "Humanities": "HSS"
      };
      const deptKey = data.department.trim();
      const deptCode = deptCodeMap[deptKey] || deptKey.slice(0, 2).toUpperCase();
      const currentYear = new Date().getFullYear();
      const allVacancies = db.getVacancies();
      const existingCount = allVacancies.filter(v => v.department.toLowerCase() === deptKey.toLowerCase()).length;
      const seq = String(existingCount + 1).padStart(2, '0');
      vacancyId = `FAC-${deptCode}-${currentYear}-${seq}`;
    } else {
      vacancyId = String(vacancyId).trim();
    }

    if (db.getVacancy(vacancyId)) {
      const err = new Error(`Vacancy with ID '${vacancyId}' already exists.`);
      err.status = 409; err.code = "DUPLICATE_VACANCY";
      throw err;
    }

    const criteriaId = `ELIG-${vacancyId.replace(/^FAC-/, '')}`;

    const newVacancy = {
      vacancyId: vacancyId,
      department: data.department.trim(),
      specialization: data.specialization.trim(),
      designation: data.designation.trim(),
      academicLevel: data.academicLevel || "Level 10",
      notes: data.notes || "Applications invited from qualified candidates.",
      educationEligibility: data.educationEligibility || data.educationRequirement || "PhD in relevant discipline",
      experienceEligibility: data.experienceEligibility || `${data.minExperienceYears || 0}+ years teaching / research`,
      compensation: data.compensation || `Pay ${data.academicLevel || 'Level 10'} (7th CPC) + DA + HRA + Institute Allowances`,
      benefits: data.benefits || "Campus residential quarters, Medical insurance, Research Seed Grant",
      incentives: data.incentives || "Conference travel grants, Cumulative Professional Development Allowance (CPDA)",
      natureOfPosition: data.natureOfPosition || "Full-time, Regular",
      location: data.location || "LNMIIT Campus, Jaipur",
      teachingResponsibilities: data.teachingResponsibilities || "UG/PG core and elective lectures, laboratory supervision",
      openingDate: openingDate,
      closingDate: closingDate,
      status: data.status || "PUBLISHED",
      criteria: {
        criteriaId: criteriaId,
        vacancyId: vacancyId,
        educationRequirement: data.educationRequirement || data.educationEligibility || "PhD",
        minExperienceYears: parseFloat(data.minExperienceYears) || 0,
        otherRequirements: data.otherRequirements || "As per institute norms"
      }
    };

    db.addVacancy(newVacancy);
    recordAuditLog(userId, "VACANCY_CREATED", "Vacancy", newVacancy.vacancyId);
    this.createNotification("ALL", "VACANCY_ANNOUNCED", `New Vacancy Listed: ${newVacancy.designation} in ${newVacancy.department} (${newVacancy.specialization}).`);

    return newVacancy;
  }

  // --- Applications (S-04, S-05, S-06, CS-1a, CS-1) ---
  getApplicationsByApplicant(applicantId) {
    return db.getApplicationsByApplicant(applicantId);
  }

  getApplication(applicationId) {
    return db.getApplication(applicationId);
  }

  getApplicantProfile(applicantId) {
    return db.getApplicantProfile(applicantId);
  }

  startApplication(applicantId, vacancyId) {
    const vacancy = this.getVacancy(vacancyId);
    if (!vacancy) {
      const err = new Error("Vacancy not found");
      err.status = 404; err.code = "NOT_FOUND";
      throw err;
    }

    if (!this.isApplicationOpen(vacancyId)) {
      const err = new Error(`Applications for this vacancy are closed. The deadline was ${vacancy.closingDate}.`);
      err.status = 409; err.code = "WINDOW_CLOSED";
      throw err;
    }

    const apps = db.getApplicationsByApplicant(applicantId);
    const existing = apps.find(a => a.vacancyId === vacancyId);

    if (existing) {
      if (existing.status === "DRAFT") {
        return { applicationId: existing.applicationId, status: "DRAFT", resumed: true };
      }
      const err = new Error(`You have already applied for this vacancy (Application ID ${existing.applicationId}).`);
      err.status = 409; err.code = "DUPLICATE_APPLICATION";
      throw err;
    }

    const allApps = db.data.applications || [];
    const nextNumber = allApps.length + 101;
    const appId = `APP-0${nextNumber}`;
    const user = (db.data.users || []).find(u => u.applicantId === applicantId);

    const newApp = {
      applicationId: appId,
      applicantId,
      applicantName: user ? user.name : "Applicant",
      applicantEmail: user ? user.email : "",
      vacancyId,
      applicationDate: new Date().toISOString().split('T')[0],
      submissionDate: null,
      status: "DRAFT",
      highestDegree: "M.Tech",
      totalExperience: 0,
      documents: [],
      screeningRecord: null,
      interviewId: null,
      hodReview: null,
      appointmentLetter: null
    };

    db.addApplication(newApp);
    return { applicationId: appId, status: "DRAFT", resumed: false };
  }

  saveDraft(applicationId, formData, applicantId) {
    const app = this.getApplication(applicationId);
    if (!app) {
      const err = new Error("Application not found");
      err.status = 404; err.code = "NOT_FOUND";
      throw err;
    }

    if (applicantId && app.applicantId !== applicantId) {
      const err = new Error("You do not have permission to modify this application.");
      err.status = 403; err.code = "FORBIDDEN";
      throw err;
    }

    if (app.status !== "DRAFT") {
      const err = new Error("Application is already submitted and cannot be modified.");
      err.status = 409; err.code = "ALREADY_SUBMITTED";
      throw err;
    }

    if (formData.profile) {
      const updatedProfile = db.saveApplicantProfile(app.applicantId, formData.profile);
      if (updatedProfile.education && updatedProfile.education.length > 0) {
        app.highestDegree = updatedProfile.education[0].degree;
      }
      if (updatedProfile.experience && updatedProfile.experience.length > 0) {
        app.totalExperience = updatedProfile.experience.reduce(
          (sum, e) => sum + (parseFloat(e.totalExperience) || 0), 0
        );
      }
      db.save();
    }

    return { status: 200, message: "Draft saved successfully" };
  }

  submitApplication(applicantId, applicationId) {
    const app = this.getApplication(applicationId);
    if (!app) {
      const err = new Error("Application not found");
      err.status = 404; err.code = "NOT_FOUND";
      throw err;
    }

    if (app.applicantId !== applicantId) {
      const err = new Error("Unauthorized: you do not own this application.");
      err.status = 403; err.code = "FORBIDDEN";
      throw err;
    }

    if (app.status !== "DRAFT") {
      const err = new Error("Application has already been submitted.");
      err.status = 409; err.code = "ALREADY_SUBMITTED";
      throw err;
    }

    const vacancy = this.getVacancy(app.vacancyId);
    if (!vacancy || !this.isApplicationOpen(vacancy.vacancyId)) {
      const err = new Error(`The application window for this vacancy is closed. Your draft has been saved but cannot be submitted.`);
      err.status = 409; err.code = "WINDOW_CLOSED";
      throw err;
    }

    // Mandatory document check (BR-006, AC-06)
    const profile = this.getApplicantProfile(applicantId) || {};
    const requiredDocs = [...MANDATORY_DOCUMENTS];
    if (profile.hasDisability) {
      requiredDocs.push("DISABILITY_CERTIFICATE");
    }

    const uploadedDocTypes = new Set((app.documents || []).map(d => d.documentType));
    const missingDocs = requiredDocs.filter(dt => !uploadedDocTypes.has(dt));

    if (missingDocs.length > 0) {
      const err = new Error(`Upload all mandatory documents to continue. Missing: ${missingDocs.join(', ')}`);
      err.status = 422; err.code = "MISSING_DOCUMENTS";
      err.fields = missingDocs.map(d => ({ name: d, error: "REQUIRED" }));
      throw err;
    }

    // Enforce valid application transition
    if (!isValidApplicationTransition(app.status, "SUBMITTED")) {
      const err = new Error(`Cannot transition application from ${app.status} to SUBMITTED.`);
      err.status = 409; err.code = "INVALID_STATE_TRANSITION";
      throw err;
    }

    app.status = "SUBMITTED";
    app.submissionDate = new Date().toISOString();
    db.save();

    recordAuditLog(applicantId, "APPLICATION_SUBMITTED", "Application", applicationId);
    this.createNotification(
      app.applicantId,
      "APPLICATION_CONFIRMATION",
      `Application ${applicationId} submitted successfully for ${vacancy.designation} (${vacancy.department}).`
    );

    return {
      applicationId: app.applicationId,
      status: app.status,
      submittedAt: app.submissionDate,
      message: "Application submitted successfully."
    };
  }

  // --- Recruitment Cell Screening (S-07, S-08, UC-007, CS-2) ---
  getApplicationsForScreening(vacancyId) {
    const vacancy = this.getVacancy(vacancyId);
    if (!vacancy) {
      const err = new Error("Vacancy not found");
      err.status = 404; err.code = "NOT_FOUND";
      throw err;
    }
    return db.getApplicationsByVacancy(vacancyId);
  }

  suggestEligibility(applicationId) {
    const app = this.getApplication(applicationId);
    if (!app) return { suggested: "REVIEW_REQUIRED", reason: "Application not found" };

    const vacancy = this.getVacancy(app.vacancyId);
    const profile = this.getApplicantProfile(app.applicantId);

    if (!profile || !profile.education || profile.education.length === 0) {
      return { suggested: "REQUIRES_REVIEW", reason: "Education details incomplete" };
    }

    const hasMTechOrPhD = profile.education.some(e =>
      e.degree.toUpperCase().includes("M.TECH") ||
      e.degree.toUpperCase().includes("PHD") ||
      e.degree.toUpperCase().includes("PH.D")
    );

    const totalExp = profile.experience ?
      profile.experience.reduce((s, e) => s + (parseFloat(e.totalExperience) || 0), 0) : 0;

    const minExp = vacancy.criteria ? vacancy.criteria.minExperienceYears : 2.0;

    if (hasMTechOrPhD && totalExp >= minExp) {
      return {
        suggested: "ELIGIBLE",
        reason: `Meets education requirement (${profile.education[0].degree}) and required experience (${totalExp} yrs >= ${minExp} yrs)`
      };
    } else {
      return {
        suggested: "NOT_ELIGIBLE",
        reason: `Does not satisfy required criteria (Degree: ${profile.education[0].degree}, Experience: ${totalExp} yrs vs required ${minExp} yrs)`
      };
    }
  }

  updateDocumentVerification(applicationId, documentId, status) {
    const app = this.getApplication(applicationId);
    if (!app || !app.documents) return;
    const doc = app.documents.find(d => d.documentId === documentId);
    if (doc) {
      doc.verificationStatus = status;
      db.save();
    }
  }

  recordScreeningResult(rcUserId, applicationId, result, comments) {
    const app = this.getApplication(applicationId);
    if (!app) {
      const err = new Error("Application not found");
      err.status = 404; err.code = "NOT_FOUND";
      throw err;
    }

    const vacancy = this.getVacancy(app.vacancyId);
    if (this.isApplicationOpen(app.vacancyId)) {
      const err = new Error(`Screening is available after the application window closes on ${vacancy.closingDate}.`);
      err.status = 409; err.code = "SCREENING_NOT_OPEN";
      throw err;
    }

    // Check if any document has issue (V-12)
    const hasDocIssue = (app.documents || []).some(d => d.verificationStatus === "REJECTED");
    if (hasDocIssue && result === "ELIGIBLE") {
      result = "REQUIRES_REVIEW";
    }

    if ((result === "NOT_ELIGIBLE" || result === "REQUIRES_REVIEW") && (!comments || !comments.trim())) {
      const err = new Error("Please enter a reason when marking an application Not eligible or Requires review.");
      err.status = 422; err.code = "COMMENT_REQUIRED";
      throw err;
    }

    let targetStatus = "ELIGIBLE";
    if (result === "NOT_ELIGIBLE") targetStatus = "NOT_ELIGIBLE";
    if (result === "REQUIRES_REVIEW") targetStatus = "REVIEW_REQUIRED";

    // Validate state transition from current state (CS-6)
    if (!["SUBMITTED", "UNDER_SCREENING", "REVIEW_REQUIRED"].includes(app.status)) {
      const err = new Error(`Cannot screen application currently in status '${app.status}'.`);
      err.status = 409; err.code = "INVALID_STATE_TRANSITION";
      throw err;
    }

    const rcUser = db.findUserById(rcUserId);
    const screeningRecord = {
      screeningId: `SCR-${Date.now().toString().slice(-4)}`,
      screenedBy: rcUser ? `${rcUser.name} (${rcUser.employeeId || 'RC'})` : "Recruitment Cell",
      result,
      comments: comments || "Approved by Recruitment Cell",
      screeningDate: new Date().toISOString()
    };

    app.screeningRecord = screeningRecord;
    app.status = targetStatus;
    db.save();

    recordAuditLog(rcUserId, "SCREENING_RECORDED", "Application", applicationId);
    this.createNotification(
      app.applicantId,
      "SCREENING_RESULT",
      `Application ${applicationId} screening completed: Result - ${targetStatus}.`
    );

    return screeningRecord;
  }

  // --- Interview Panel (S-09, S-10, S-11, UC-009/10, CS-3, CS-5) ---
  getAssignedInterviews(memberId) {
    return db.getAssignedInterviews(memberId);
  }

  getInterview(interviewId) {
    return db.getInterview(interviewId);
  }

  markAttendance(interviewId, memberId, attended) {
    const iv = this.getInterview(interviewId);
    if (!iv) {
      const err = new Error("Interview not found");
      err.status = 404; err.code = "NOT_FOUND";
      throw err;
    }

    if (!iv.panel.some(p => p.memberId === memberId)) {
      const err = new Error("You are not assigned to this interview.");
      err.status = 403; err.code = "NOT_ASSIGNED";
      throw err;
    }

    if (!iv.attendance) iv.attendance = {};
    iv.attendance[memberId] = attended;

    if (!attended) {
      iv.status = "NOT_ATTENDED";
      iv.recommendation = "NOT_RECOMMENDED";
      iv.panelRemarks = "Candidate marked as Not Attended by panel member.";
      iv.finalized = true;

      const app = this.getApplication(iv.applicationId);
      if (app) app.status = "REJECTED";

      db.save();
      recordAuditLog(memberId, "INTERVIEW_NOT_ATTENDED", "Interview", interviewId);
      return { status: "NOT_ATTENDED", message: "Candidate marked as Not Attended. Process terminated." };
    } else {
      if (iv.status === "SCHEDULED") {
        iv.status = "IN_PROGRESS";
      }
      db.save();
      return { status: iv.status, message: "Attendance confirmed." };
    }
  }

  submitEvaluation(memberId, interviewId, score, comments) {
    const iv = this.getInterview(interviewId);
    if (!iv) {
      const err = new Error("Interview not found");
      err.status = 404; err.code = "NOT_FOUND";
      throw err;
    }

    const panelMember = iv.panel.find(p => p.memberId === memberId);
    if (!panelMember) {
      const err = new Error("You are not assigned to this interview.");
      err.status = 403; err.code = "NOT_ASSIGNED";
      throw err;
    }

    if (iv.status === "NOT_ATTENDED") {
      const err = new Error("Candidate did not attend this interview.");
      err.status = 409; err.code = "INTERVIEW_NOT_CONDUCTED";
      throw err;
    }

    const numScore = parseFloat(score);
    if (isNaN(numScore) || numScore < 0 || numScore > 10) {
      const err = new Error("Score must be between 0 and 10.");
      err.status = 422; err.code = "SCORE_OUT_OF_RANGE";
      throw err;
    }

    if (!comments || !comments.trim()) {
      const err = new Error("Comments are required to complete the evaluation.");
      err.status = 422; err.code = "INCOMPLETE_EVALUATION";
      throw err;
    }

    if (!iv.evaluations) iv.evaluations = [];

    let evalObj = iv.evaluations.find(e => e.memberId === memberId);
    if (!evalObj) {
      evalObj = {
        evaluationId: `EVL-${Date.now().toString().slice(-4)}`,
        memberId,
        memberName: panelMember.name,
        score: numScore,
        comments: comments.trim(),
        evaluationDate: new Date().toISOString()
      };
      iv.evaluations.push(evalObj);
    } else {
      evalObj.score = numScore;
      evalObj.comments = comments.trim();
      evalObj.evaluationDate = new Date().toISOString();
    }

    const panelSize = iv.panel.length;
    const submittedCount = iv.evaluations.length;

    if (submittedCount >= panelSize) {
      const total = iv.evaluations.reduce((sum, e) => sum + e.score, 0);
      iv.aggregateScore = parseFloat((total / panelSize).toFixed(1));
      iv.status = "VALIDATED";
    } else {
      iv.status = "EVALUATION_PENDING";
    }

    db.save();
    recordAuditLog(memberId, "EVALUATION_SUBMITTED", "Interview", interviewId);

    return {
      evaluationId: evalObj.evaluationId,
      submitted: submittedCount,
      panelSize,
      aggregateScore: iv.aggregateScore,
      status: iv.status
    };
  }

  finalizeInterview(memberId, interviewId, recommendation, remarks) {
    const iv = this.getInterview(interviewId);
    if (!iv) {
      const err = new Error("Interview not found");
      err.status = 404; err.code = "NOT_FOUND";
      throw err;
    }

    if (iv.status !== "VALIDATED") {
      const remaining = iv.panel.length - (iv.evaluations ? iv.evaluations.length : 0);
      const err = new Error(`Waiting for ${remaining} panel member(s). The result will be shown when all evaluations are submitted.`);
      err.status = 409; err.code = "EVALUATIONS_PENDING";
      throw err;
    }

    iv.recommendation = recommendation;
    iv.panelRemarks = remarks || "";
    iv.status = "COMPLETED";
    iv.finalized = true;

    const app = this.getApplication(iv.applicationId);
    if (app) {
      if (recommendation === "RECOMMENDED") {
        app.status = "SHORTLISTED";
        this.createNotification(
          "U001",
          "EVALUATION_RESULT",
          `Candidate ${iv.candidateName} (${iv.applicationId}) has been RECOMMENDED by panel for HOD final review.`
        );
      } else {
        app.status = "REJECTED";
      }
    }

    db.save();
    recordAuditLog(memberId, "RECOMMENDATION_CONFIRMED", "Interview", interviewId);

    return {
      status: "COMPLETED",
      recommendation,
      aggregateScore: iv.aggregateScore,
      message: "Interview evaluation finalized and forwarded to HOD."
    };
  }

  // --- HOD Review (UC-012, FR-027, FR-028) ---
  hodDecision(hodId, applicationId, decision, remarks) {
    const app = this.getApplication(applicationId);
    if (!app) {
      const err = new Error("Application not found");
      err.status = 404; err.code = "NOT_FOUND";
      throw err;
    }

    if (app.status !== "SHORTLISTED") {
      const err = new Error(`Cannot approve application currently in status '${app.status}'. An application must be recommended by the interview panel first.`);
      err.status = 409; err.code = "INVALID_STATE_TRANSITION";
      throw err;
    }

    app.hodReview = {
      reviewed: true,
      approved: decision === "APPROVED",
      decision,
      comments: remarks || "",
      decisionDate: new Date().toISOString()
    };

    if (decision === "APPROVED") {
      app.status = "APPROVED_BY_HOD";
      this.createNotification(
        "U007",
        "EVALUATION_RESULT",
        `HOD has approved appointment of ${app.applicantName} for vacancy ${app.vacancyId}. Ready for appointment letter generation.`
      );
    } else {
      app.status = "REJECTED_BY_HOD";
    }

    db.save();
    recordAuditLog(hodId, `HOD_${decision}`, "Application", applicationId);
    return app.hodReview;
  }

  // --- Appointment Letter Generation (UC-013, FR-029) ---
  generateAppointmentLetter(rcUserId, applicationId) {
    const app = this.getApplication(applicationId);
    if (!app) {
      const err = new Error("Application not found");
      err.status = 404; err.code = "NOT_FOUND";
      throw err;
    }

    if (app.status !== "APPROVED_BY_HOD") {
      const err = new Error(`Appointment letter cannot be generated before HOD approval. Current status is '${app.status}'.`);
      err.status = 409; err.code = "INVALID_STATE_TRANSITION";
      throw err;
    }

    const vacancy = this.getVacancy(app.vacancyId);

    const letter = {
      referenceNo: `LNMIIT/REC/2026/APPT-${Date.now().toString().slice(-4)}`,
      issueDate: new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }),
      candidateName: app.applicantName,
      position: vacancy ? vacancy.designation : "Assistant Professor",
      department: vacancy ? vacancy.department : "Computer Science",
      academicLevel: vacancy ? vacancy.academicLevel : "Level 10",
      basicPay: "₹ 57,700/- per month (Pay Matrix Level 10)",
      reportingDate: "1st January 2027",
      issuedBy: "Registrar / Recruitment Cell, LNMIIT Jaipur"
    };

    app.appointmentLetter = letter;
    app.status = "APPOINTED";
    db.save();

    recordAuditLog(rcUserId, "APPOINTMENT_LETTER_GENERATED", "Application", applicationId);
    this.createNotification(
      app.applicantId,
      "APPLICATION_CONFIRMATION",
      `Congratulations! Official appointment letter generated for your selection as ${letter.position}. Reference: ${letter.referenceNo}`
    );

    return letter;
  }

  // --- Notifications ---
  createNotification(recipientId, type, message) {
    const notif = {
      notificationId: `NOTIF-${Date.now().toString().slice(-4)}`,
      recipientId,
      type,
      message,
      timestamp: new Date().toISOString(),
      status: "SENT"
    };
    return db.addNotification(notif);
  }

  getNotifications(userId) {
    return db.getNotifications(userId);
  }
}

const recruitmentService = new RecruitmentService();

module.exports = recruitmentService;
