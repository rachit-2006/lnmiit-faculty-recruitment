// LNMIIT Faculty Recruitment Workflow Management System - Server
const express = require('express');
const path = require('path');
const config = require('./src/config');
const db = require('./src/db/db');
const errorHandler = require('./src/middleware/errorHandler');

// Route imports
const authRoutes = require('./src/routes/authRoutes');
const vacancyRoutes = require('./src/routes/vacancyRoutes');
const applicationRoutes = require('./src/routes/applicationRoutes');
const documentRoutes = require('./src/routes/documentRoutes');
const screeningRoutes = require('./src/routes/screeningRoutes');
const interviewRoutes = require('./src/routes/interviewRoutes');
const hodRoutes = require('./src/routes/hodRoutes');
const notificationRoutes = require('./src/routes/notificationRoutes');
const auditRoutes = require('./src/routes/auditRoutes');
const authController = require('./src/controllers/authController');

const app = express();

// --- 1. Security & Parsing Middleware ---
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// --- 2. REST API Routes ---
app.use('/api/auth', authRoutes);
app.get('/api/demo-users', authController.getDemoUsers);
app.post('/api/reset-demo', authController.resetDemoData);

app.use('/api/vacancies', vacancyRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/rc', screeningRoutes);
app.use('/api/panel', interviewRoutes);
app.use('/api/hod', hodRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/audit-logs', auditRoutes);

// --- 3. Static Assets & SPA Fallback ---
app.use(express.static(config.PUBLIC_DIR));

// Fallback to index.html for SPA client-side routes or 404 for unhandled API routes
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({
      status: 404,
      code: 'NOT_FOUND',
      message: 'API endpoint not found',
      path: req.path,
      timestamp: new Date().toISOString()
    });
  }
  res.sendFile(path.join(config.PUBLIC_DIR, 'index.html'));
});

// --- 4. Centralized Error Handling ---
app.use(errorHandler);

// --- 5. Start Server ---
if (require.main === module) {
  db.init().then(() => {
    app.listen(config.PORT, () => {
      console.log("==================================================================");
      console.log("LNMIIT Faculty Recruitment Workflow Management System - CS314 Lab");
      console.log(`Server running at http://localhost:${config.PORT}`);
      console.log("Database initialized and persistent at data/database.json");
      console.log("==================================================================");
    });
  }).catch(err => {
    console.error("Failed to initialize database:", err);
    process.exit(1);
  });
}

module.exports = app;
