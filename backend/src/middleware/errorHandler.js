/**
 * Central error handler middleware.
 * Must be registered LAST in Express middleware chain.
 */
function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  if (process.env.NODE_ENV !== "production") {
    console.error(`[ERROR] ${req.method} ${req.path}:`, err);
  }

  res.status(status).json({
    error: {
      message,
      ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
    },
  });
}

class AppError extends Error {
  constructor(message, status = 500) {
    super(message);
    this.status = status;
    this.name = "AppError";
  }
}

module.exports = { errorHandler, AppError };
