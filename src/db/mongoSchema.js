// MongoDB / Mongoose Schema Models Specification
// Maps the same entity definitions for MongoDB deployments

const UserSchema = {
  userId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { 
    type: String, 
    required: true, 
    enum: ['APPLICANT', 'RECRUITMENT_CELL', 'INTERVIEW_PANEL', 'HOD', 'ADMINISTRATOR'] 
  },
  active: { type: Boolean, default: true },
  applicantId: String,
  employeeId: String,
  memberId: String,
  hodId: String,
  department: String,
  phone: String,
  createdAt: { type: Date, default: Date.now }
};

const SessionSchema = {
  sessionId: { type: String, required: true, unique: true },
  token: { type: String, required: true, unique: true },
  userId: { type: String, required: true },
  role: { type: String, required: true },
  applicantId: String,
  employeeId: String,
  memberId: String,
  hodId: String,
  department: String,
  createdAt: { type: Date, default: Date.now },
  expiresAt: { type: Date, required: true, index: { expires: 0 } }
};

const ApplicantProfileSchema = {
  profileId: { type: String, required: true, unique: true },
  applicantId: { type: String, required: true, unique: true },
  dateOfBirth: String,
  willingnessToRelocate: { type: Boolean, default: true },
  hasDisability: { type: Boolean, default: false },
  disabilityType: String,
  currentAddress: {
    plotBuilding: String,
    locality: String,
    city: String,
    state: String,
    pincode: String
  },
  permanentAddress: {
    plotBuilding: String,
    locality: String,
    city: String,
    state: String,
    pincode: String
  },
  education: [{
    educationId: String,
    degree: String,
    fieldOfStudy: String,
    institute: String,
    grade: String,
    startYear: Number,
    endYear: Number
  }],
  experience: [{
    experienceId: String,
    organization: String,
    position: String,
    startYear: Number,
    endYear: Number,
    totalExperience: Number
  }],
  researchPapers: [{
    paperId: String,
    title: String,
    yearOfPublication: Number,
    journalOrConference: String
  }]
};

const VacancySchema = {
  vacancyId: { type: String, required: true, unique: true },
  department: { type: String, required: true },
  specialization: { type: String, required: true },
  designation: { type: String, required: true },
  academicLevel: { type: String, default: 'Level 10' },
  notes: String,
  educationEligibility: { type: String, required: true },
  experienceEligibility: { type: String, required: true },
  compensation: String,
  benefits: String,
  incentives: String,
  natureOfPosition: { type: String, default: 'Full-time, Regular' },
  location: { type: String, default: 'LNMIIT Campus, Jaipur' },
  teachingResponsibilities: String,
  openingDate: { type: String, required: true },
  closingDate: { type: String, required: true },
  status: { 
    type: String, 
    default: 'PUBLISHED', 
    enum: ['SUBMITTED', 'LISTED', 'PUBLISHED', 'CLOSED'] 
  },
  criteria: {
    criteriaId: String,
    vacancyId: String,
    educationRequirement: String,
    minExperienceYears: Number,
    otherRequirements: String
  }
};

const ApplicationSchema = {
  applicationId: { type: String, required: true, unique: true },
  applicantId: { type: String, required: true },
  applicantName: { type: String, required: true },
  applicantEmail: { type: String, required: true },
  vacancyId: { type: String, required: true },
  applicationDate: { type: String, required: true },
  submissionDate: String,
  status: {
    type: String,
    default: 'DRAFT',
    enum: [
      'DRAFT', 'SUBMITTED', 'UNDER_SCREENING', 'ELIGIBLE',
      'NOT_ELIGIBLE', 'REVIEW_REQUIRED', 'SHORTLISTED', 'REJECTED',
      'INTERVIEW_SCHEDULED', 'APPROVED_BY_HOD', 'REJECTED_BY_HOD', 'APPOINTED'
    ]
  },
  highestDegree: String,
  totalExperience: Number,
  documents: [{
    documentId: String,
    documentType: String,
    fileName: String,
    storagePath: String,
    fileSizeKB: Number,
    mimeType: String,
    uploadDate: String,
    verificationStatus: { type: String, default: 'PENDING', enum: ['PENDING', 'VERIFIED', 'REJECTED'] }
  }],
  screeningRecord: {
    screeningId: String,
    screenedBy: String,
    result: String,
    comments: String,
    screeningDate: String
  },
  interviewId: String,
  hodReview: {
    reviewed: Boolean,
    approved: Boolean,
    decision: String,
    comments: String,
    decisionDate: String
  },
  appointmentLetter: {
    referenceNo: String,
    issueDate: String,
    candidateName: String,
    position: String,
    department: String,
    academicLevel: String,
    basicPay: String,
    reportingDate: String,
    issuedBy: String
  }
};

const InterviewSchema = {
  interviewId: { type: String, required: true, unique: true },
  applicationId: { type: String, required: true, unique: true },
  vacancyId: { type: String, required: true },
  candidateName: { type: String, required: true },
  interviewDate: { type: String, required: true },
  interviewTime: { type: String, required: true },
  status: {
    type: String,
    default: 'SCHEDULED',
    enum: [
      'SCHEDULED', 'RESCHEDULED', 'IN_PROGRESS', 'EVALUATION_PENDING',
      'EVALUATION_INCOMPLETE', 'EVALUATED', 'VALIDATED', 'COMPLETED', 'NOT_ATTENDED'
    ]
  },
  panel: [{
    memberId: String,
    name: String,
    designation: String,
    department: String
  }],
  evaluations: [{
    evaluationId: String,
    memberId: String,
    memberName: String,
    score: Number,
    comments: String,
    evaluationDate: String
  }],
  attendance: { type: Map, of: Boolean },
  aggregateScore: Number,
  recommendation: { type: String, default: 'PENDING', enum: ['PENDING', 'RECOMMENDED', 'NOT_RECOMMENDED'] },
  panelRemarks: String,
  finalized: { type: Boolean, default: false }
};

const AuditLogSchema = {
  logId: { type: String, required: true, unique: true },
  userId: { type: String, required: true },
  action: { type: String, required: true },
  entityType: { type: String, required: true },
  entityId: { type: String, required: true },
  timestamp: { type: Date, default: Date.now, index: true }
};

module.exports = {
  UserSchema,
  SessionSchema,
  ApplicantProfileSchema,
  VacancySchema,
  ApplicationSchema,
  InterviewSchema,
  AuditLogSchema
};
