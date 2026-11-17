-- ============================================================================
-- LNMIIT Faculty Recruitment Workflow Management System
-- Database Schema (PostgreSQL) - CS314 Software Development Laboratory
-- Design Model Specification derived from Assignment 6 §1.5.2 & §1.7
-- ============================================================================

-- 1. Users Table (Core entity for authentication and common identity)
CREATE TABLE IF NOT EXISTS users (
    user_id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('APPLICANT', 'RECRUITMENT_CELL', 'INTERVIEW_PANEL', 'HOD', 'ADMINISTRATOR')),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    applicant_id VARCHAR(50),
    employee_id VARCHAR(50),
    member_id VARCHAR(50),
    hod_id VARCHAR(50),
    department VARCHAR(100),
    phone VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(LOWER(email));
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- 2. Sessions Table (Server-side session management with 12-hour expiry)
CREATE TABLE IF NOT EXISTS sessions (
    session_id VARCHAR(50) PRIMARY KEY,
    token VARCHAR(255) NOT NULL UNIQUE,
    user_id VARCHAR(50) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL,
    applicant_id VARCHAR(50),
    employee_id VARCHAR(50),
    member_id VARCHAR(50),
    hod_id VARCHAR(50),
    department VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions(expires_at);

-- 3. Applicant Profiles (1:1 with applicant user)
CREATE TABLE IF NOT EXISTS applicant_profiles (
    profile_id VARCHAR(50) PRIMARY KEY,
    applicant_id VARCHAR(50) NOT NULL UNIQUE,
    user_id VARCHAR(50) NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    date_of_birth DATE,
    phone VARCHAR(20),
    willingness_to_relocate BOOLEAN DEFAULT TRUE,
    has_disability BOOLEAN DEFAULT FALSE,
    disability_type VARCHAR(100),
    current_plot_building VARCHAR(255),
    current_locality VARCHAR(255),
    current_city VARCHAR(100),
    current_state VARCHAR(100),
    current_pincode VARCHAR(20),
    permanent_plot_building VARCHAR(255),
    permanent_locality VARCHAR(255),
    permanent_city VARCHAR(100),
    permanent_state VARCHAR(100),
    permanent_pincode VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. Education Records (Composition with ApplicantProfile)
CREATE TABLE IF NOT EXISTS educations (
    education_id VARCHAR(50) PRIMARY KEY,
    applicant_id VARCHAR(50) NOT NULL REFERENCES applicant_profiles(applicant_id) ON DELETE CASCADE,
    degree VARCHAR(100) NOT NULL,
    field_of_study VARCHAR(255) NOT NULL,
    institute VARCHAR(255) NOT NULL,
    grade VARCHAR(50),
    start_year INT,
    end_year INT
);

-- 5. Experience Records (Composition with ApplicantProfile)
CREATE TABLE IF NOT EXISTS experiences (
    experience_id VARCHAR(50) PRIMARY KEY,
    applicant_id VARCHAR(50) NOT NULL REFERENCES applicant_profiles(applicant_id) ON DELETE CASCADE,
    organization VARCHAR(255) NOT NULL,
    position VARCHAR(100) NOT NULL,
    start_year INT,
    end_year INT,
    total_experience NUMERIC(5, 2) NOT NULL DEFAULT 0.0
);

-- 6. Research Papers (Applicant research history)
CREATE TABLE IF NOT EXISTS research_papers (
    paper_id VARCHAR(50) PRIMARY KEY,
    applicant_id VARCHAR(50) NOT NULL REFERENCES applicant_profiles(applicant_id) ON DELETE CASCADE,
    title VARCHAR(500) NOT NULL,
    year_of_publication INT,
    journal_or_conference VARCHAR(255)
);

-- 7. Vacancies Table
CREATE TABLE IF NOT EXISTS vacancies (
    vacancy_id VARCHAR(50) PRIMARY KEY,
    department VARCHAR(100) NOT NULL,
    specialization VARCHAR(255) NOT NULL,
    designation VARCHAR(100) NOT NULL,
    academic_level VARCHAR(50) DEFAULT 'Level 10',
    notes TEXT,
    education_eligibility TEXT NOT NULL,
    experience_eligibility TEXT NOT NULL,
    compensation VARCHAR(255),
    benefits TEXT,
    incentives TEXT,
    nature_of_position VARCHAR(100) DEFAULT 'Full-time, Regular',
    location VARCHAR(255) DEFAULT 'LNMIIT Campus, Jaipur',
    teaching_responsibilities TEXT,
    opening_date DATE NOT NULL,
    closing_date DATE NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PUBLISHED' CHECK (status IN ('SUBMITTED', 'LISTED', 'PUBLISHED', 'CLOSED')),
    created_by VARCHAR(50) REFERENCES users(user_id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT check_vacancy_dates CHECK (closing_date >= opening_date)
);

-- 8. Eligibility Criteria (Composition with Vacancy, 1:1)
CREATE TABLE IF NOT EXISTS eligibility_criteria (
    criteria_id VARCHAR(50) PRIMARY KEY,
    vacancy_id VARCHAR(50) NOT NULL UNIQUE REFERENCES vacancies(vacancy_id) ON DELETE CASCADE,
    education_requirement VARCHAR(255) NOT NULL,
    min_experience_years NUMERIC(5, 2) NOT NULL DEFAULT 0.0,
    other_requirements TEXT
);

-- 9. Applications Table
CREATE TABLE IF NOT EXISTS applications (
    application_id VARCHAR(50) PRIMARY KEY,
    applicant_id VARCHAR(50) NOT NULL,
    applicant_name VARCHAR(255) NOT NULL,
    applicant_email VARCHAR(255) NOT NULL,
    vacancy_id VARCHAR(50) NOT NULL REFERENCES vacancies(vacancy_id) ON DELETE RESTRICT,
    application_date DATE NOT NULL DEFAULT CURRENT_DATE,
    submission_date TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) NOT NULL DEFAULT 'DRAFT' CHECK (status IN (
        'DRAFT', 'SUBMITTED', 'UNDER_SCREENING', 'ELIGIBLE',
        'NOT_ELIGIBLE', 'REVIEW_REQUIRED', 'SHORTLISTED', 'REJECTED',
        'INTERVIEW_SCHEDULED', 'APPROVED_BY_HOD', 'REJECTED_BY_HOD', 'APPOINTED'
    )),
    highest_degree VARCHAR(100),
    total_experience NUMERIC(5, 2) DEFAULT 0.0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_applicant_vacancy UNIQUE (applicant_id, vacancy_id)
);

CREATE INDEX IF NOT EXISTS idx_apps_applicant ON applications(applicant_id);
CREATE INDEX IF NOT EXISTS idx_apps_vacancy ON applications(vacancy_id);
CREATE INDEX IF NOT EXISTS idx_apps_status ON applications(status);

-- 10. Documents Table (Attached to application)
CREATE TABLE IF NOT EXISTS documents (
    document_id VARCHAR(50) PRIMARY KEY,
    application_id VARCHAR(50) NOT NULL REFERENCES applications(application_id) ON DELETE CASCADE,
    document_type VARCHAR(100) NOT NULL CHECK (document_type IN (
        'AADHAR_CARD', 'BIRTH_CERTIFICATE', 'MARKSHEET_10', 'MARKSHEET_12',
        'BACHELORS_DEGREE', 'MASTERS_DEGREE', 'POST_MASTERS_DEGREE',
        'EXPERIENCE_CERTIFICATE', 'DISABILITY_CERTIFICATE'
    )),
    file_name VARCHAR(255) NOT NULL,
    storage_path VARCHAR(500) NOT NULL,
    file_size_kb INT NOT NULL CHECK (file_size_kb > 0 AND file_size_kb <= 2048),
    mime_type VARCHAR(100) NOT NULL,
    upload_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    verification_status VARCHAR(50) NOT NULL DEFAULT 'PENDING' CHECK (verification_status IN ('PENDING', 'VERIFIED', 'REJECTED')),
    CONSTRAINT unique_app_document_type UNIQUE (application_id, document_type)
);

-- 11. Screening Records (Recruitment Cell screening outcome)
CREATE TABLE IF NOT EXISTS screening_records (
    screening_id VARCHAR(50) PRIMARY KEY,
    application_id VARCHAR(50) NOT NULL REFERENCES applications(application_id) ON DELETE CASCADE,
    screened_by VARCHAR(255) NOT NULL,
    result VARCHAR(50) NOT NULL CHECK (result IN ('ELIGIBLE', 'NOT_ELIGIBLE', 'REQUIRES_REVIEW')),
    comments TEXT,
    screening_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 12. Interviews Table
CREATE TABLE IF NOT EXISTS interviews (
    interview_id VARCHAR(50) PRIMARY KEY,
    application_id VARCHAR(50) NOT NULL UNIQUE REFERENCES applications(application_id) ON DELETE CASCADE,
    vacancy_id VARCHAR(50) NOT NULL REFERENCES vacancies(vacancy_id),
    candidate_name VARCHAR(255) NOT NULL,
    interview_date DATE NOT NULL,
    interview_time VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN (
        'SCHEDULED', 'RESCHEDULED', 'IN_PROGRESS', 'EVALUATION_PENDING',
        'EVALUATION_INCOMPLETE', 'EVALUATED', 'VALIDATED', 'COMPLETED', 'NOT_ATTENDED'
    )),
    aggregate_score NUMERIC(4, 2),
    recommendation VARCHAR(50) DEFAULT 'PENDING' CHECK (recommendation IN ('PENDING', 'RECOMMENDED', 'NOT_RECOMMENDED')),
    panel_remarks TEXT,
    finalized BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 13. Interview Panel Assignment (Many-to-Many join table)
CREATE TABLE IF NOT EXISTS interview_panel (
    interview_id VARCHAR(50) NOT NULL REFERENCES interviews(interview_id) ON DELETE CASCADE,
    member_id VARCHAR(50) NOT NULL,
    member_name VARCHAR(255) NOT NULL,
    designation VARCHAR(100),
    department VARCHAR(100),
    PRIMARY KEY (interview_id, member_id)
);

-- 14. Evaluations Table (Panel scoring and comments)
CREATE TABLE IF NOT EXISTS evaluations (
    evaluation_id VARCHAR(50) PRIMARY KEY,
    interview_id VARCHAR(50) NOT NULL REFERENCES interviews(interview_id) ON DELETE CASCADE,
    member_id VARCHAR(50) NOT NULL,
    member_name VARCHAR(255) NOT NULL,
    score NUMERIC(4, 2) NOT NULL CHECK (score >= 0 AND score <= 10),
    comments TEXT NOT NULL,
    evaluation_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_interview_evaluator UNIQUE (interview_id, member_id)
);

-- 15. HOD Review Records
CREATE TABLE IF NOT EXISTS hod_reviews (
    review_id VARCHAR(50) PRIMARY KEY,
    application_id VARCHAR(50) NOT NULL UNIQUE REFERENCES applications(application_id) ON DELETE CASCADE,
    hod_id VARCHAR(50) NOT NULL,
    decision VARCHAR(50) NOT NULL CHECK (decision IN ('APPROVED', 'REJECTED')),
    comments TEXT,
    decision_date TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 16. Appointment Letters (Final formal issuance)
CREATE TABLE IF NOT EXISTS appointment_letters (
    letter_id VARCHAR(50) PRIMARY KEY,
    application_id VARCHAR(50) NOT NULL UNIQUE REFERENCES applications(application_id) ON DELETE CASCADE,
    reference_no VARCHAR(100) NOT NULL UNIQUE,
    issue_date VARCHAR(50) NOT NULL,
    candidate_name VARCHAR(255) NOT NULL,
    position VARCHAR(100) NOT NULL,
    department VARCHAR(100) NOT NULL,
    academic_level VARCHAR(50) NOT NULL,
    basic_pay VARCHAR(100) NOT NULL,
    reporting_date VARCHAR(50) NOT NULL,
    issued_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 17. Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
    notification_id VARCHAR(50) PRIMARY KEY,
    recipient_id VARCHAR(50) NOT NULL,
    notification_type VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) NOT NULL DEFAULT 'SENT' CHECK (status IN ('PENDING', 'SENT', 'FAILED', 'READ'))
);

CREATE INDEX IF NOT EXISTS idx_notifs_recipient ON notifications(recipient_id);

-- 18. Audit Log Table (Insert-only for accountability, NFR-007, NFR-020)
CREATE TABLE IF NOT EXISTS audit_logs (
    log_id VARCHAR(50) PRIMARY KEY,
    user_id VARCHAR(50) NOT NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(100) NOT NULL,
    entity_id VARCHAR(100) NOT NULL,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs(user_id);
