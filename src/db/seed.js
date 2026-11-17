// Seed Data with real scrypt password hashes
const { initialData } = require('../data/seedData');
const { hashPassword } = require('../services/authService');

const DEFAULT_PASSWORDS = {
  "APPLICANT": "Applicant@123",
  "RECRUITMENT_CELL": "Recruiter@123",
  "INTERVIEW_PANEL": "Panel@123",
  "HOD": "Hod@123",
  "ADMINISTRATOR": "Admin@123"
};

async function generateSeedData() {
  const seed = JSON.parse(JSON.stringify(initialData));

  // Ensure sessions and documents collections exist
  seed.sessions = [];
  seed.uploadedFiles = [];

  // Hash passwords for each user
  for (const user of seed.users) {
    const rawPass = DEFAULT_PASSWORDS[user.role] || "LNMIIT@Recruit2026";
    user.passwordHash = await hashPassword(rawPass);
  }

  return seed;
}

module.exports = {
  generateSeedData,
  DEFAULT_PASSWORDS
};
