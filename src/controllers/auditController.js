// Audit Controller (NFR-007, NFR-020)
const db = require('../db/db');

async function getAuditLogs(req, res, next) {
  try {
    // Ordinary users cannot modify or delete audit records; viewable by staff
    const logs = db.getAuditLogs();
    res.status(200).json(logs);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAuditLogs
};
