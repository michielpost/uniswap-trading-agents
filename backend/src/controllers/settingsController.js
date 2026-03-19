/**
 * settingsController.js
 * Per-user settings store (in-memory). Includes Venice API key.
 */

const { validationResult } = require("express-validator");
const { AppError } = require("../middleware/errorHandler");

// address (lowercase) -> { veniceApiKey: string }
const settingsStore = new Map();

function getSettingsForAddress(address) {
  return settingsStore.get(address.toLowerCase()) ?? { veniceApiKey: "" };
}

// ─── GET /api/settings ────────────────────────────────────────────────────────
async function getSettings(req, res, next) {
  try {
    const settings = getSettingsForAddress(req.user.address);
    // Never expose the full key to the client — return masked version
    const { veniceApiKey } = settings;
    res.json({
      veniceApiKey: veniceApiKey
        ? `${veniceApiKey.slice(0, 6)}${"*".repeat(Math.max(0, veniceApiKey.length - 10))}${veniceApiKey.slice(-4)}`
        : "",
      hasVeniceApiKey: !!veniceApiKey,
    });
  } catch (err) { next(err); }
}

// ─── PUT /api/settings ────────────────────────────────────────────────────────
async function updateSettings(req, res, next) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) throw new AppError(errors.array()[0].msg, 400);

    const address = req.user.address.toLowerCase();
    const existing = settingsStore.get(address) ?? {};
    const updated = { ...existing };

    if (typeof req.body.veniceApiKey === "string") {
      updated.veniceApiKey = req.body.veniceApiKey.trim();
    }

    settingsStore.set(address, updated);

    res.json({
      message: "Settings updated",
      hasVeniceApiKey: !!updated.veniceApiKey,
    });
  } catch (err) { next(err); }
}

module.exports = { getSettings, updateSettings, getSettingsForAddress, settingsStore };
