# LNMIIT Faculty Recruitment Workflow Management System

**Course:** CS314 Software Development Laboratory  
**Institution:** The LNM Institute of Information Technology, Jaipur  
**Team ID:** T076  
**Team Members:**
- **Rachit Poddar** (24UCS176)
- **Nivi Jain** (24UCS177)
- **Maheshwar Pratap Singh** (24UCS182)
- **Daivik Patodi** (24UCS184)

---

## 📌 Executive Summary

The **Faculty Recruitment Workflow Management System** is a secure, persistent, role-governed web application designed to digitize and streamline the faculty hiring lifecycle at LNMIIT—from vacancy creation and applicant self-service registration to multi-round document screening, panel-based scoring, departmental HOD approval, and official appointment letter generation.

The system enforces sound software engineering practices developed across **Lab Assignments 1 through 7**, featuring an immutable audit trail, cryptographically secure password hashing (`crypto.scrypt`), role-based access control (RBAC), fine-grained data ownership isolation, a persistent 18-table Relational Database backend, and a 44-test automated verification suite with 100% pass rate.

---

## ⚡ Quick Start & Execution

### Prerequisites
- Node.js v18.0.0 or higher (v20 LTS recommended).  
  *Note:* A portable standalone Node.js LTS environment is also included in the repository under `tools/node-v20.18.0-win-x64/` for instant execution without system administrative installation.

### 1. Install Dependencies
```bash
npm install
```
*(Dependencies: `express`, `multer`)*

### 2. Configure Environment (Optional)
```bash
cp .env.example .env
```
Default parameters run out-of-the-box on port `3000` with local persistent database storage.

### 3. Start the Server
```bash
npm start
```
The server will start at:
👉 **`http://localhost:3000`**

### 4. Run Automated Test Suite
```bash
npm test
```
Runs all 44 unit and integration tests across Authentication, RBAC, and Recruitment Workflow State Transitions with **100% pass rate**.

---

## 🔑 Demo Personas & Credentials

The application is pre-seeded with institutional test personas matching the scenarios in Lab Assignments 1–7. You can quickly switch between them using the top Persona Bar or sign in manually with these credentials:

| Role | Name | Email | Password | Access Scope / Wireframe |
|---|---|---|---|---|
| **Applicant** | Rahul Sharma | `rahul.sharma@example.com` | `Applicant@123` | Vacancy search, draft application, doc upload, progress tracking (S-01 to S-06) |
| **Recruitment Cell** | Anita Verma | `anita.verma@lnmiit.ac.in` | `Recruiter@123` | Vacancy listing, document screening, eligibility marking, appointment letter generation (S-07, S-08) |
| **Interview Panel 1** | Dr. K. Iyer | `k.iyer@lnmiit.ac.in` | `Panel@123` | Assigned interviews, candidate attendance, scoring (0–10) & comments (S-09, S-10, S-11) |
| **Interview Panel 2** | Dr. S. Bansal | `s.bansal@lnmiit.ac.in` | `Panel@123` | Secondary panel evaluations and recommendation consensus (S-09, S-10, S-11) |
| **Head of Department (CSE)** | Prof. P. K. Biswas | `hod.cse@lnmiit.ac.in` | `Hod@123` | Review shortlisted candidates for CSE department and approve/reject appointment (UC-012) |

---

## 📝 Step-by-Step: How to Register a New Applicant Account

1. Open **`http://localhost:3000`** in your browser.
2. If already logged in as a demo user, click **"Sign Out"** in the top navigation bar.
3. On the Login screen, click the prominent **"Applicant Sign Up"** tab or button.
4. Fill in the self-service registration form:
   - **Full Name:** (e.g., `Dr. Samantha Sen`)
   - **Email Address:** (e.g., `samantha.sen@example.com`)
   - **Phone Number:** (Optional, 10-digit mobile)
   - **Password:** Minimum 10 characters (e.g., `Candidate@2026`)
   - **Confirm Password:** Must match password exactly.
5. Click **"Create Applicant Account"**.
6. **Automatic Security Enforcement:**
   - The server validates input formats (FR-001, FR-016).
   - Duplicate email registration attempts are rejected with `409 Conflict`.
   - Passwords shorter than 10 characters are rejected with `422 Unprocessable Entity`.
   - The user is **strictly auto-assigned** the `APPLICANT` role (client-side role tampering is ignored).
   - The password is encrypted with a 16-byte random salt using `crypto.scrypt`.
   - A 64-character session token is generated, auto-logging the user in and redirecting to the **Open Vacancies** page.

---

## 🔒 Security & Authorization Architecture

### 1. Cryptographic Password Hashing & Verification
- Implemented in [`src/services/authService.js`](file:///C:/Users/RACHIT%20PODDAR/Desktop/lnmiit-faculty-recruitment/src/services/authService.js):
  - Password hashing uses Node.js standard `crypto.scrypt` with a cryptographically secure 16-byte random salt (`crypto.randomBytes(16)`).
  - Password verification uses constant-time comparison via `crypto.timingSafeEqual` to protect against side-channel and timing attacks.
  - Password hashes and salts are **never exposed** in API responses, logs, or client payloads.
  - Authentication failure responses always return a generic `401 Unauthorized` message ("Invalid email or password. Please try again.") without revealing user existence (FR-004).

### 2. Session Management
- 64-character hex cryptographically random session tokens (`crypto.randomBytes(32)`).
- Enforced 12-hour session expiration.
- Complete server-side invalidation on logout (`POST /api/auth/logout`), preventing replay attacks.

### 3. Role-Based Access Control (RBAC) & Data Isolation
- Enforced by middleware in [`src/middleware/rbac.js`](file:///C:/Users/RACHIT%20PODDAR/Desktop/lnmiit-faculty-recruitment/src/middleware/rbac.js):
  - **Ownership Checking:** Applicants can only view, save, or submit their own applications. Direct requests to `/api/applications/:id` for other candidates return `403 Forbidden`.
  - **Administrative Protection:** Applicants cannot access Recruitment Cell endpoints (`/api/rc/*`), panel scoring (`/api/panel/*`), HOD reviews (`/api/hod/*`), or audit trails (`/api/audit-logs`).
  - **Departmental Scoping:** An HOD (e.g., CSE) cannot review or approve candidates applying for vacancies in other departments (e.g., ECE) (`403 Forbidden`).

### 4. Secure File Uploads with Magic-Byte Inspection
- Implemented in [`src/services/documentService.js`](file:///C:/Users/RACHIT%20PODDAR/Desktop/lnmiit-faculty-recruitment/src/services/documentService.js):
  - 2 MB maximum file limit per document.
  - Magic byte verification inspecting actual file header bytes (PDF: `%PDF` / `0x25 0x50 0x44 0x46`, JPG: `\xFF\xD8\xFF`, PNG: `\x89PNG`). Files with spoofed extensions are rejected with `422 Unprocessable Entity`.
  - Filename sanitization against directory traversal (`../`) and shell injection.
  - Documents are stored securely outside the `public/` webroot under `storage/documents/` using UUID-prefixed filenames.
  - Document downloads (`GET /api/documents/:documentId`) verify role and application ownership before streaming.

### 5. Immutable Audit Trail
- All significant business and security events (`APPLICANT_REGISTERED`, `USER_LOGIN`, `USER_LOGOUT`, `APPLICATION_SUBMITTED`, `SCREENING_RECORDED`, `EVALUATION_SUBMITTED`, `HOD_APPROVED`, `APPOINTMENT_OFFERED`) are permanently recorded via [`src/services/auditService.js`](file:///C:/Users/RACHIT%20PODDAR/Desktop/lnmiit-faculty-recruitment/src/services/auditService.js) with timestamp, actor ID, action, and target entity.

---

## 🔄 Recruitment Workflow & State Machine

The recruitment workflow strictly implements the state transitions and business rules specified in Assignments 5, 6, and 7:

```
[DRAFT]
   │
   ▼ (Upload mandatory documents: CV, PG Degree, ID, etc.)
[SUBMITTED]
   │
   ▼ (Recruitment Cell Screening - FR-018 to FR-023)
[ELIGIBLE] / [NOT_ELIGIBLE] / [REVIEW_REQUIRED]
   │
   ▼ (Recruitment Cell Schedules Panel Interview - CS-3)
[INTERVIEW_SCHEDULED]
   │
   ▼ (Panel marks attendance & scores 0–10 with comments - CS-5)
[INTERVIEW_COMPLETED / VALIDATED]
   │
   ▼ (Panel Recommendation Consensus: RECOMMENDED)
[SHORTLISTED]
   │
   ▼ (HOD Departmental Review - UC-012, FR-027)
[APPROVED_BY_HOD]
   │
   ▼ (Recruitment Cell issues official appointment letter - UC-013, FR-029)
[APPOINTED]
```

### Business Rules Enforced by the Backend
- **BR-001 (Vacancy Publication):** Vacancies must have department, designation, specialization, and closing date before listing.
- **BR-003 (Duplicity Prevention):** An applicant cannot apply twice for the same vacancy (`409 Conflict`).
- **BR-005 (Immutable Submissions):** Once submitted, application data and documents cannot be modified by the applicant.
- **BR-006 (Mandatory Documentation):** Submission without mandatory documents (Aadhar, Master's Degree, Experience Certificate, 10th Marksheet, Birth Certificate) is rejected with `422 Unprocessable Entity`.
- **State Transition Guard:** Attempting to skip states (e.g., approving an interview before screening, or generating an appointment letter before HOD approval) is rejected with `409 Conflict`.
- **Panel Scoring Constraint:** Evaluation scores must be numeric between 0 and 10 with mandatory comments (`422 Unprocessable Entity`).

---

## 💾 Persistence Layer & Relational Database Engine

The application features a fully working, persistent multi-model database layer guaranteeing zero data loss across server restarts:

### 1. Built-in Persistent Relational SQL Database Engine ([`src/db/relationalDb.js`](file:///C:/Users/RACHIT%20PODDAR/Desktop/lnmiit-faculty-recruitment/src/db/relationalDb.js))
- Implements a self-contained relational SQL database engine managing **18 normalized tables** matching Lab Assignment 6 DDL specifications.
- **Relational Integrity:** Primary key indexing (`Map`), unique constraints, foreign key referential integrity, and cascading lookups.
- **Query Engine:** Supports SQL `SELECT` with table projections, column aliasing, `WHERE` predicates (`=`, `!=`, `<`, `>`, `<=`, `>=`, `LIKE`), `ORDER BY` (ASC/DESC), `LIMIT`, and `INSERT INTO`.
- **Disk Persistence:** Serializes database state atomically to disk snapshot [`data/recruitment.db`](file:///C:/Users/RACHIT%20PODDAR/Desktop/lnmiit-faculty-recruitment/data/recruitment.db) on every commit.
- **SQL Dump Export:** Generates clean, ANSI-standard SQL DDL and `INSERT` statements to [`data/recruitment.sql`](file:///C:/Users/RACHIT%20PODDAR/Desktop/lnmiit-faculty-recruitment/data/recruitment.sql), directly importable into PostgreSQL, SQLite, or MySQL.

### 2. The 18 Normalized Relational Tables:
| # | Table Name | Primary Key | Description |
|---|---|---|---|
| 1 | `users` | `user_id` | Authentication identities, scrypt password hashes, salts, and roles |
| 2 | `sessions` | `token` | Active cryptographic sessions with 12-hour expiry and IP/UA metadata |
| 3 | `applicant_profiles` | `profile_id` | Personal details, phone numbers, addresses, category, disability status |
| 4 | `educations` | `education_id` | Academic degrees (10th, 12th, Bachelor's, Master's, PhD) with GPA & Year |
| 5 | `experiences` | `experience_id` | Teaching and industry employment history with designations and tenures |
| 6 | `research_papers` | `paper_id` | Publications, peer-reviewed journals, citations, and DOI references |
| 7 | `vacancies` | `vacancy_id` | Published faculty openings, academic levels, departments, and deadlines |
| 8 | `eligibility_criteria` | `criteria_id` | Minimum qualification requirements per vacancy (FR-009) |
| 9 | `applications` | `application_id` | Candidate applications bound to vacancies, tracking workflow states |
| 10 | `documents` | `document_id` | Uploaded files with MIME types, verified magic bytes, and disk paths |
| 11 | `screening_records` | `screening_id` | Two-stage document screening outcomes and eligibility evaluations |
| 12 | `interviews` | `interview_id` | Scheduled interview sessions, committee panels, modes, and venues |
| 13 | `interview_panel` | `id` | Panelist committee assignments for candidates |
| 14 | `evaluations` | `evaluation_id` | Scoring (0–10), qualitative remarks, and hiring recommendations |
| 15 | `hod_reviews` | `review_id` | Departmental head review decisions (APPROVED / REJECTED) with rationale |
| 16 | `appointment_letters` | `letter_id` | Official appointment documents with pay scale, reference codes, dates |
| 17 | `notifications` | `notification_id` | In-app alerts and notifications delivered to users across stages |
| 18 | `audit_logs` | `log_id` | Immutable security and operational audit trail with timestamps |

### 3. Alternative Enterprise Persistence Schemas
- **Enterprise PostgreSQL DDL:** [`src/db/schema.sql`](file:///C:/Users/RACHIT%20PODDAR/Desktop/lnmiit-faculty-recruitment/src/db/schema.sql) with PostgreSQL triggers, constraints, foreign keys, and indexes.
- **Enterprise MongoDB Schema:** [`src/db/mongoSchema.js`](file:///C:/Users/RACHIT%20PODDAR/Desktop/lnmiit-faculty-recruitment/src/db/mongoSchema.js) with Mongoose schemas and indexes.

---

## 🧪 Automated Test Suite (44 Tests)

Run the test suite using:
```bash
npm test
```

### Test Suite Execution Output:
```
✔ Authentication & Account Management Test Suite (13 tests)
  ✔ FR-001: Applicant Registration (6 tests: valid reg, duplicate 409, short pass 422, mismatch 422, invalid email 422, anti-privilege escalation)
  ✔ FR-002, FR-003, FR-004: User Authentication & Login (5 tests: applicant login, all institutional roles, bad password 401, unknown email 401, missing credentials 401)
  ✔ FR-005: Logout & Session Termination (2 tests: server-side token invalidation, rejection of fake/missing tokens)

✔ Role-Based Authorization & Data Isolation Test Suite (16 tests)
  ✔ Applicant Role Boundaries & Ownership Enforcement (9 tests: view own application, forbid viewing other candidates 403, forbid editing others 403, forbid RC endpoints 403, forbid vacancy creation 403, forbid panel endpoints 403, forbid HOD endpoints 403, forbid audit logs 403)
  ✔ Interview Panel Role Boundaries (3 tests: view assigned interviews, forbid HOD decisions 403, forbid appointment letters 403)
  ✔ HOD Departmental Authorization Scope (2 tests: review CSE candidates, forbid reviewing ECE candidates 403)
  ✔ Administrator Elevated Scope (2 tests: audit logs access, administrative application oversight)

✔ Recruitment Workflow & State Machine Test Suite (15 tests)
  ✔ Application Initiation & BR-003 Duplicity Prevention (2 tests: start draft on open vacancy, reject duplicate application 409)
  ✔ Document Upload & Magic-Byte Verification (2 tests: reject spoofed non-PDF 422, accept authentic %PDF)
  ✔ Application Submission & Mandatory Document Checks (2 tests: reject incomplete submission 422, accept complete submission)
  ✔ Invalid State Transition Protection (2 tests: reject appointment letter before HOD approval 409, reject HOD approval before interview 409)
  ✔ Interview Panel Evaluation & Score Range Validation (4 tests: reject score > 10 422, reject score < 0 422, reject empty comments 422, accept valid evaluation 201)
  ✔ End-to-End Recruitment Cycle (3 tests: panel recommendation to SHORTLIST, HOD approval to APPROVED_BY_HOD, RC generates APPOINTED letter)

Total: 44 passed, 0 failed across 16 suites (100% success rate)
```

---

## 📂 Project Directory Structure

```
lnmiit-faculty-recruitment/
├── data/
│   ├── database.json          # Persistent JSON database (auto-initialized & saved atomically)
│   ├── recruitment.db         # Persistent relational SQL database snapshot
│   └── recruitment.sql        # Exported ANSI SQL database dump
├── docs/
│   ├── PROTOTYPE_GUIDE.md     # Step-by-step presentation script for CS314 lab evaluation
│   ├── UML_MODELS_SUMMARY.md  # Summary of SRS, Activity, Class, Sequence & State diagrams
│   └── WIREFRAMES_S01_S11.md  # Screen wireframe mappings (S-01 to S-11)
├── public/                    # Frontend client assets
│   ├── css/
│   │   └── style.css          # LNMIIT branding, responsive layout, auth styling
│   ├── js/
│   │   └── app.js             # Client SPA controller & persona switcher
│   └── index.html             # Single-page application shell
├── src/
│   ├── config.js              # Centralized environment configuration
│   ├── controllers/           # REST API Route Controllers
│   │   ├── applicationController.js
│   │   ├── appointmentController.js
│   │   ├── auditController.js
│   │   ├── authController.js
│   │   ├── documentController.js
│   │   ├── hodController.js
│   │   ├── interviewController.js
│   │   ├── notificationController.js
│   │   ├── screeningController.js
│   │   └── vacancyController.js
│   ├── db/
│   │   ├── db.js              # Multi-model database orchestrator with atomic writes
│   │   ├── mongoSchema.js     # Enterprise MongoDB / Mongoose models
│   │   ├── relationalDb.js    # Built-in 18-table Relational SQL Database Engine
│   │   ├── schema.sql         # Enterprise PostgreSQL 18-table relational DDL
│   │   └── seed.js            # Seed generator with scrypt password hashing
│   ├── middleware/
│   │   ├── auth.js            # Session token verification & expiration
│   │   ├── errorHandler.js    # Assignment 7 compliant error payload formatter
│   │   └── rbac.js            # Role-based access control & ownership checking
│   ├── routes/                # Express API route declarations
│   ├── services/
│   │   ├── auditService.js    # Immutable audit logging
│   │   ├── authService.js     # scrypt hashing & session management
│   │   ├── documentService.js # Magic byte file inspection & safe storage
│   │   └── recruitmentService.js # Core domain business logic & state transitions
│   └── stateMachine.js        # Valid application & interview state transition tables
├── storage/
│   └── documents/             # Safe storage for uploaded applicant documents
├── tests/
│   ├── auth.test.js           # 13 tests for registration, login, logout, passwords
│   ├── rbac.test.js           # 16 tests for roles, data isolation & HOD scoping
│   ├── testHelper.js          # In-memory sandboxed test dispatch runner
│   └── workflow.test.js       # 15 tests for full recruitment state machine
├── tools/
│   └── node-v20.18.0-win-x64/ # Portable Node.js runtime for standalone execution
├── .env.example               # Example environment configuration
├── package.json               # Node.js project manifest & scripts
├── README.md                  # Comprehensive technical documentation
└── server.js                  # Express application server entrypoint
```

---

## 🎯 Scope and Deliberate Limitations

### Implemented Scope
- Complete digitization of faculty recruitment from vacancy publication to appointment.
- Self-service applicant registration with strict role validation and scrypt security.
- File upload handling with MIME & magic-byte verification up to 2 MB.
- Two-stage screening, panel evaluation consensus, attendance, and 0–10 scoring.
- Departmental approval gate by Head of Department (HOD).
- Official appointment letter generation with reference numbers and pay details.
- Role-based access control and applicant ownership isolation.
- Immutable audit log and in-app notifications.

### Deliberate Exclusions (As defined in Assignment 1 & 2 Scope):
- **Payroll & Benefits Integration:** Active appointment letters are handed over to the administrative registrar; salary disbursement is handled by external institute ERP.
- **Third-Party Job Board Integration:** Vacancies are published on the institute portal; syndication to LinkedIn or Indeed is outside current lab scope.
- **AI/ATS Resume Auto-Ranking:** All qualification verification is intentionally performed by authorized human evaluators (Recruitment Cell and Faculty Panels).
- **Video Interview Conferencing:** The system schedules, coordinates, and grades interviews; video calls occur via Google Meet or in-person campus panel rooms.

---

## 👥 Authors & Academic Attribution

Developed for **CS314 Software Development Laboratory** at **The LNM Institute of Information Technology, Jaipur**:
- **Rachit Poddar** (24UCS176) — Full-Stack Architecture, Security & Persistence
- **Nivi Jain** (24UCS177) — UI/UX Wireframes, Workflow Modeling & Component Specifications
- **Maheshwar Pratap Singh** (24UCS182) — Domain Class Modeling, Relational & NoSQL Schema Design
- **Daivik Patodi** (24UCS184) — State Machines, Activity Scenarios & Quality Assurance Test Suite
