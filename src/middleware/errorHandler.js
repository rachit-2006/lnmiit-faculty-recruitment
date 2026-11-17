// Standardized Error Handler (Assignment 7 §3.2.4)

function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  const errorPayload = {
    status: status,
    code: err.code || 'SYSTEM_ERROR',
    message: err.message || 'An unexpected error occurred',
    fields: err.fields || [],
    path: req.originalUrl || req.path,
    timestamp: new Date().toISOString()
  };

  if (status >= 500) {
    console.error(`[Error ${status}] on ${req.method} ${req.originalUrl}:`, err);
  }

  res.status(status).json(errorPayload);
}

module.exports = errorHandler;
