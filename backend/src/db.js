/**
 * db.js - SQLite database setup using better-sqlite3 (synchronous).
 * Tables: agents, settings, activity_logs
 */
const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = process.env.DB_PATH
  ? path.dirname(process.env.DB_PATH)
  : path.join(__dirname, '..', 'data');

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const dbPath = process.env.DB_PATH || path.join(dataDir, 'agents.db');
const db = new Database(dbPath);

// Enable WAL mode for better concurrent performance
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS agents (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    owner TEXT NOT NULL,
    skills TEXT DEFAULT '',
    status TEXT DEFAULT 'stopped',
    contract_address TEXT,
    vault_address TEXT,
    total_trades INTEGER DEFAULT 0,
    total_pnl TEXT DEFAULT '0',
    last_price TEXT,
    tx_hash TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS settings (
    address TEXT PRIMARY KEY,
    venice_api_key TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS activity_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_id TEXT NOT NULL,
    ts INTEGER NOT NULL,
    type TEXT NOT NULL,
    summary TEXT NOT NULL,
    details TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_activity_agent ON activity_logs(agent_id, ts DESC);
`);

module.exports = db;
