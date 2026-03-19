/**
 * middleware/auth.js
 * Re-exports authenticate for backward compatibility.
 * index.js imports from both authenticate.js and auth.js.
 */
const { authenticate } = require("./authenticate");

/**
 * optionalAuth — attaches req.user if token is present, but never blocks.
 * Useful for public endpoints that show extra data when logged in.
 */
const jwt = require("jsonwebtoken");
function optionalAuth(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7);
    try {
      req.user = jwt.verify(token, process.env.JWT_SECRET);
    } catch (_) {
      req.user = null;
    }
  }
  next();
}

module.exports = { authenticate, optionalAuth };
