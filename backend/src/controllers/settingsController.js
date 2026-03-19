/**
 * settingsController.js
 * Per-user settings backed by SQLite.
 */
const { validationResult } = require("express-validator");
const { AppError } = require("../middleware/errorHandler");
const db = require("../db");

function getSettingsForAddress(address) {
  const row = db.prepare('SELECT * FROM settings WHERE address = ?').get(address.toLowerCase());
  return row ? { veniceApiKey: row.venice_api_key || '' } : { veniceApiKey: '' };
}

// ─── GET /api/settings ────────────────────────────────────────────────────────
async function getSettings(req, res, next) {
  try {
    const settings = getSettingsForAddress(req.user.address);
    const { veniceApiKey } = settings;
    res.json({
      veniceApiKey: veniceApiKey
        ? `${veniceApiKey.slice(0, 6)}${'*'.repeat(Math.max(0, veniceApiKey.length - 10))}${veniceApiKey.slice(-4)}`
        : '',
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
    if (typeof req.body.veniceApiKey === 'string') {
      db.prepare(`
        INSERT INTO settings (address, venice_api_key) VALUES (?, ?)
        ON CONFLICT(address) DO UPDATE SET venice_api_key=excluded.venice_api_key
      `).run(address, req.body.veniceApiKey.trim());
    }
    const updated = getSettingsForAddress(address);
    res.json({ message: 'Settings updated', hasVeniceApiKey: !!updated.veniceApiKey });
  } catch (err) { next(err); }
}

module.exports = { getSettings, updateSettings, getSettingsForAddress };

