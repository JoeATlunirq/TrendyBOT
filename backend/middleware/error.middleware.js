/**
 * Basic error handling middleware.
 * Catches errors passed by next(error) and sends a JSON response.
 */
const errorHandler = (err, req, res, next) => {
  console.error('Error Middleware Caught:', err.stack);

  // Use statusCode from error if available, otherwise default to 500
  const statusCode = err.statusCode || 500;

  // Use message from error, or a generic message
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).json({
    message: message,
    // Optionally include stack trace in development
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
};

module.exports = {
  errorHandler,
}; 