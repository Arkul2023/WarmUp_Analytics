import "./config/env";

import express from "express";
import { connectDatabase } from "./config/database";
import authRoutes from "./routes/auth";
import mailwizzRoutes from "./routes/mailwizz";
import mailboxRoutes from "./routes/mailboxes";
import mailwizzDbRoutes from "./routes/mailwizzDB";
import campaignRoutes from './routes/campaign';
import dashboardRoutes from './routes/dashboard';
import workerRoutes, { proxyToWorker } from './routes/worker';

const app = express();

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use(express.json());

// Assignment 5 Dashboard API (Supports ?scope=all|recent)
app.get("/api/dashboard", (req, res) => {
  const scope = req.query.scope || "recent";
  proxyToWorker(req, res, `/api/dashboard?scope=${scope}`);
});

// Assignment 1 & Auth routes
app.use("/api/auth", authRoutes);
app.use("/api/mailwizz/db", mailwizzDbRoutes);
app.use("/api/mailwizz", mailwizzRoutes);
app.use("/api/mailboxes", mailboxRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/campaigns", campaignRoutes);

// Assignment 5 Worker routes & proxy
app.use("/api/worker", workerRoutes);
app.use("/api/warmup", workerRoutes);

// Additional direct API aliases requested in spec
app.get("/api/warmup-replies", (req, res) => proxyToWorker(req, res, "/api/replies"));
app.post("/api/dashboard/reset", (req, res) => proxyToWorker(req, res, "/api/dashboard/reset"));

import { sshTunnelService } from "./services/sshTunnel.service";
import { testMailwizzDbConnection } from "./config/mailwizzDB";

const PORT = process.env.PORT || 5000;

async function main() {
  // 1. Automate Server Login Connection (SSH Tunnel) before Database Connection
  try {
    console.log("[Startup] Initializing automated server login connection (SSH)...");
    await sshTunnelService.ensureDefaultTunnel();
    console.log("[Startup] ✓ Automated server login connection active.");
  } catch (err: any) {
    console.warn("[Startup] ⚠ SSH server auto-connection warning:", err?.message || err);
    console.warn("[Startup] Database queries will attempt to reconnect on demand.");
  }

  // 2. Connect MongoDB Database
  await connectDatabase();

  // 3. Optional preflight verification of MailWizz DB
  try {
    const health = await testMailwizzDbConnection();
    if (health.connected) {
      console.log(`[Startup] ✓ MailWizz Database connected (${health.database}, ${health.serverVersion}, ${health.tablesCount ?? 0} tables).`);
    }
  } catch (err: any) {
    console.warn("[Startup] MailWizz DB preflight test note:", err?.message || err);
  }

  const server = app.listen(PORT, () => {
    console.log(`Server listening on ${PORT}`);
  });

  // Graceful shutdown
  const shutdown = async () => {
    console.log("Shutting down server...");
    try {
      await sshTunnelService.closeAllTunnels();
    } catch {}
    server.close(() => {
      process.exit(0);
    });
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("Failed to start", err);
  process.exit(1);
});