/**
 * routes/agents.js
 * Agent CRUD, lifecycle (start/stop/deploy), fund management, and trade history.
 */

const express = require("express");
const { body, param, query } = require("express-validator");
const {
  listAgents,
  createAgent,
  getAgent,
  updateAgentSkills,
  startAgent,
  stopAgent,
  getAgentTrades,
  getAgentStats,
  deployAgent,
  depositFunds,
  withdrawFunds,
  deleteAgent,
  getPublicAgent,
  getAgentLogs,
  generateSkills,
} = require("../controllers/agentController");

const router = express.Router();

// GET /api/agents/:id/public — public, no auth (must be before authenticated /:id)
router.get("/:id/public", param("id").notEmpty(), getPublicAgent);

// POST /api/agents/generate-skills — Venice AI natural language → skills.md
router.post(
  "/generate-skills",
  [body("description").trim().notEmpty().withMessage("Strategy description is required")
                               .isLength({ max: 500 }).withMessage("Description max 500 chars")],
  generateSkills
);

// GET  /api/agents
router.get("/", listAgents);

// POST /api/agents
router.post(
  "/",
  [
    body("name").trim().notEmpty().withMessage("Agent name is required"),
    body("name").isLength({ max: 50 }).withMessage("Name max 50 chars"),
    body("skills").optional().isString(),
  ],
  createAgent
);

// GET  /api/agents/:id
router.get("/:id", param("id").notEmpty(), getAgent);

// PUT  /api/agents/:id/skills
router.put(
  "/:id/skills",
  [
    param("id").notEmpty(),
    body("skills").notEmpty().withMessage("skills.md content is required"),
  ],
  updateAgentSkills
);

// POST /api/agents/:id/start
router.post("/:id/start", param("id").notEmpty(), startAgent);

// POST /api/agents/:id/stop
router.post("/:id/stop", param("id").notEmpty(), stopAgent);

// POST /api/agents/:id/deploy
router.post("/:id/deploy", param("id").notEmpty(), deployAgent);

// GET  /api/agents/:id/trades
router.get(
  "/:id/trades",
  [
    param("id").notEmpty(),
    query("limit").optional().isInt({ min: 1, max: 200 }),
    query("offset").optional().isInt({ min: 0 }),
  ],
  getAgentTrades
);

// GET  /api/agents/:id/metrics
router.get("/:id/metrics", param("id").notEmpty(), getAgentStats);

// GET  /api/agents/:id/logs
router.get("/:id/logs", param("id").notEmpty(), getAgentLogs);

// POST /api/agents/:id/deposit
router.post(
  "/:id/deposit",
  [
    param("id").notEmpty(),
    body("amount").isNumeric().withMessage("Amount must be numeric"),
    body("token").optional().isEthereumAddress(),
  ],
  depositFunds
);

// POST /api/agents/:id/withdraw
router.post(
  "/:id/withdraw",
  [
    param("id").notEmpty(),
    body("amount").isNumeric().withMessage("Amount must be numeric"),
    body("token").optional().isEthereumAddress(),
    body("to").optional().isEthereumAddress(),
  ],
  withdrawFunds
);

// DELETE /api/agents/:id
router.delete("/:id", param("id").notEmpty(), deleteAgent);

module.exports = router;
