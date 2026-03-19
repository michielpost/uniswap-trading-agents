require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const http = require("http");
const { WebSocketServer } = require("ws");

// Route imports
const authRoutes   = require("./routes/auth");
const agentRoutes  = require("./routes/agents");
const tradeRoutes  = require("./routes/trades");
const marketRoutes = require("./routes/market");

// Middleware imports
const { rateLimiter }  = require("./middleware/rateLimiter");
const { errorHandler } = require("./middleware/errorHandler");
const { authenticate } = require("./middleware/authenticate");

const app    = express();
const server = http.createServer(app);
const PORT   = process.env.PORT || 4000;

// ─── Global Middleware ────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin:      process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,
}));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(rateLimiter);

// ─── Health Check ─────────────────────────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({
    status:    "ok",
    timestamp: new Date().toISOString(),
    version:   process.env.npm_package_version || "1.0.0",
    chainId:   process.env.CHAIN_ID || "1",
    network:   process.env.NODE_ENV || "development",
  });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use("/api/auth",   authRoutes);
app.use("/api/agents", authenticate, agentRoutes);
app.use("/api/trades", authenticate, tradeRoutes);
app.use("/api/market", authenticate, marketRoutes);

// ─── API docs stub ────────────────────────────────────────────────────────────
app.get("/api", (req, res) => {
  res.json({
    version: "1.0.0",
    endpoints: {
      auth:   "/api/auth   — POST /login, GET /nonce, POST /logout",
      agents: "/api/agents — CRUD + start/stop/deploy/deposit/withdraw",
      trades: "/api/trades — execute/history/quote/cancel/metrics",
      market: "/api/market — quote/price/pool",
      ws:     "ws://host/ws — subscribe by address for live events",
    },
  });
});

// ─── WebSocket Server ─────────────────────────────────────────────────────────
const wss = new WebSocketServer({ server, path: "/ws" });
const clients = new Map(); // address -> Set<WebSocket>

wss.on("connection", (ws, req) => {
  console.log("[WS] New client connected");
  let userAddress = null;

  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data.toString());
      if (msg.type === "subscribe" && msg.address) {
        userAddress = msg.address.toLowerCase();
        if (!clients.has(userAddress)) clients.set(userAddress, new Set());
        clients.get(userAddress).add(ws);
        ws.send(JSON.stringify({ type: "subscribed", address: userAddress }));
        console.log(`[WS] Subscribed: ${userAddress}`);
      } else if (msg.type === "ping") {
        ws.send(JSON.stringify({ type: "pong", timestamp: Date.now() }));
      }
    } catch (e) {
      ws.send(JSON.stringify({ type: "error", message: "Invalid message format" }));
    }
  });

  ws.on("close", () => {
    if (userAddress && clients.has(userAddress)) {
      clients.get(userAddress).delete(ws);
      if (clients.get(userAddress).size === 0) clients.delete(userAddress);
    }
    console.log("[WS] Client disconnected");
  });

  ws.on("error", (err) => console.error("[WS] Error:", err.message));
});

// ─── Broadcast helper — used by agent engine to push real-time events ─────────
app.locals.broadcast = (address, event) => {
  const sockets = clients.get(address?.toLowerCase());
  if (!sockets) return;
  const payload = JSON.stringify(event);
  for (const ws of sockets) {
    if (ws.readyState === ws.OPEN) ws.send(payload);
  }
};

// ─── 404 handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: { message: `Route ${req.method} ${req.path} not found` } });
});

// ─── Error Handler (must be last) ─────────────────────────────────────────────
app.use(errorHandler);

// ─── Start Server ─────────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`\n🚀 Uniswap Trading Agents API`);
  console.log(`   HTTP:  http://localhost:${PORT}`);
  console.log(`   WS:    ws://localhost:${PORT}/ws`);
  console.log(`   Env:   ${process.env.NODE_ENV || "development"}`);
  console.log(`   Chain: ${process.env.CHAIN_ID || "1"}\n`);
});

module.exports = { app, server };
