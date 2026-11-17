// Audit Service (NFR-007, NFR-020)
const db = require('../db/db');

function recordAuditLog(userId, action, entityType, entityId) {
  const entry = {
    logId: `LOG-${Date.now().toString().slice(-4)}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
    userId: userId || 'SYSTEM',
    action,
    entityType,
    entityId,
    timestamp: new Date().toISOString()
  };
  return db.addAuditLog(entry);
}

module.exports = {
  recordAuditLog
};
