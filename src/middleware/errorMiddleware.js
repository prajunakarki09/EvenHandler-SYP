/**
 * Centralized error-handling middleware
 */
function errorHandler(err, req, res, next) {
  console.error('Unhandled Error:', err);

  // Catch invalid JSON in request bodies
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      success: false,
      message: 'Malformed JSON payload received.',
    });
  }

  const statusCode = err.status || 500;
  return res.status(statusCode).json({
    success: false,
    message: err.message || 'Internal server error occurred.',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
}

/**
 * 404 Route Not Found middleware
 */
function notFoundHandler(req, res) {
  return res.status(404).json({
    success: false,
    message: `Resource not found: ${req.method} ${req.originalUrl}`,
  });
}

module.exports = {
  errorHandler,
  notFoundHandler,
};
