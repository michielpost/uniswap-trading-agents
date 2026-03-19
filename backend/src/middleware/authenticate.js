const jwt = require("jsonwebtoken");
const { AppError } = require("./errorHandler");

/**
 * JWT authentication middleware.
 * Expects: Authorization: Bearer <token>
 */
function authenticate(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(new AppError("Missing or invalid Authorization header", 401));
  }

  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { address, iat, exp }
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return next(new AppError("Token expired", 401));
    }
    return next(new AppError("Invalid token", 401));
  }
}

module.exports = { authenticate };
