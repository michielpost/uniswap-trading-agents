const jwt = require("jsonwebtoken");
const { ethers } = require("ethers");
const { validationResult } = require("express-validator");
const { AppError } = require("../middleware/errorHandler");

// In-memory nonce store (use Redis in production)
const nonceStore = new Map();

/**
 * GET /api/auth/nonce?address=0x...
 * Returns a one-time nonce for SIWE message construction.
 */
async function getNonce(req, res, next) {
  try {
    const { address } = req.query;
    if (!address || !ethers.isAddress(address)) {
      throw new AppError("Valid Ethereum address required", 400);
    }
    const nonce = ethers.hexlify(ethers.randomBytes(16)).slice(2);
    nonceStore.set(address.toLowerCase(), { nonce, createdAt: Date.now() });
    res.json({ nonce });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/login
 * Verifies SIWE message + signature, returns JWT.
 */
async function login(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) throw new AppError(errors.array()[0].msg, 400);

    const { message, signature } = req.body;

    // Parse address from message (simple EIP-4361 parser)
    const addressMatch = message.match(/0x[a-fA-F0-9]{40}/);
    if (!addressMatch) throw new AppError("Could not parse address from message", 400);
    const address = addressMatch[0].toLowerCase();

    // Verify nonce
    const stored = nonceStore.get(address);
    if (!stored) throw new AppError("No nonce found for address — request a nonce first", 401);
    if (Date.now() - stored.createdAt > 5 * 60 * 1000) {
      nonceStore.delete(address);
      throw new AppError("Nonce expired", 401);
    }
    if (!message.includes(stored.nonce)) {
      throw new AppError("Nonce mismatch", 401);
    }

    // Recover signer
    const recoveredAddress = ethers.verifyMessage(message, signature).toLowerCase();
    if (recoveredAddress !== address) {
      throw new AppError("Signature verification failed", 401);
    }

    // Clean up nonce
    nonceStore.delete(address);

    // Issue JWT
    const token = jwt.sign(
      { address },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
    );

    res.json({ token, address });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/auth/logout
 */
async function logout(req, res) {
  // JWT is stateless; client just discards the token.
  // If using a token blacklist / Redis, invalidate here.
  res.json({ message: "Logged out successfully" });
}

module.exports = { getNonce, login, logout };
