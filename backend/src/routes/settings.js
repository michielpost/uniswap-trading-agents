const express = require("express");
const { body } = require("express-validator");
const { getSettings, updateSettings } = require("../controllers/settingsController");
const { authenticate } = require("../middleware/authenticate");

const router = express.Router();

// GET /api/settings
router.get("/", authenticate, getSettings);

// PUT /api/settings
router.put(
  "/",
  authenticate,
  [body("veniceApiKey").optional().isString()],
  updateSettings
);

module.exports = router;
