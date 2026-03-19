const express = require("express");
const { body, query } = require("express-validator");
const { getNonce, login, logout } = require("../controllers/authController");

const router = express.Router();

// GET /api/auth/nonce?address=0x...
router.get("/nonce", query("address").notEmpty(), getNonce);

// POST /api/auth/login
router.post(
  "/login",
  [
    body("message").notEmpty().withMessage("SIWE message is required"),
    body("signature").notEmpty().withMessage("Signature is required"),
  ],
  login
);

// POST /api/auth/logout
router.post("/logout", logout);

module.exports = router;
