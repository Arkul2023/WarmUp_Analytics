import { Router, Request, Response } from "express";
import fetch from "node-fetch";

const router = Router();

const WORKER_URL = process.env.PLACEMENT_WORKER_URL || "http://localhost:8000";

export const proxyToWorker = async (req: Request, res: Response, path: string) => {
  try {
    const url = `${WORKER_URL}${path}`;
    const options: any = {
      method: req.method,
      headers: {
        "Content-Type": "application/json",
      },
    };

    if (req.method !== "GET" && req.method !== "HEAD") {
      options.body = JSON.stringify(req.body);
    }

    const response = await fetch(url, options);
    
    let data;
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      data = await response.json();
    } else {
      const text = await response.text();
      try {
        data = JSON.parse(text);
      } catch (e) {
        data = { message: text };
      }
    }

    res.status(response.status).json(data);
  } catch (error: any) {
    console.error(`Worker Proxy Error [${path}]:`, error);
    res.status(502).json({ error: "Failed to communicate with Python worker", details: error.message });
  }
};

// Core telemetry & state
router.get("/stats", (req, res) => proxyToWorker(req, res, "/api/stats"));
router.get("/status", (req, res) => proxyToWorker(req, res, "/api/worker/status"));
router.get("/scans", (req, res) => proxyToWorker(req, res, "/api/worker/scans"));

// Step 1 / Step 2 / Full Cycle / Stop Controls
router.post("/step1", (req, res) => proxyToWorker(req, res, "/api/worker/step1"));
router.post("/step2", (req, res) => proxyToWorker(req, res, "/api/worker/step2"));
router.post("/full_cycle", (req, res) => proxyToWorker(req, res, "/api/worker/full_cycle"));
router.post("/stop", (req, res) => proxyToWorker(req, res, "/api/worker/stop"));

// Accounts
router.get("/accounts", (req, res) => proxyToWorker(req, res, "/api/accounts"));
router.post("/accounts", (req, res) => proxyToWorker(req, res, "/api/accounts"));
router.post("/accounts/bulk-delete", (req, res) => proxyToWorker(req, res, "/api/accounts/bulk-delete"));
router.post("/accounts/test", (req, res) => proxyToWorker(req, res, "/api/accounts/test"));
router.post("/accounts/test-all", (req, res) => proxyToWorker(req, res, "/api/accounts/test-all"));

// Warmup Replies
router.get("/replies", (req, res) => proxyToWorker(req, res, "/api/replies"));
router.post("/replies", (req, res) => proxyToWorker(req, res, "/api/replies"));
router.post("/replies/update", (req, res) => proxyToWorker(req, res, "/api/replies/update"));
router.delete("/replies/:idx", (req, res) => proxyToWorker(req, res, `/api/replies/${req.params.idx}`));

// Execution Controls (Aliases)
router.post("/run", (req, res) => proxyToWorker(req, res, "/api/worker/step1"));
router.post("/scan", (req, res) => proxyToWorker(req, res, "/api/worker/step1"));
router.post("/engage", (req, res) => proxyToWorker(req, res, "/api/worker/step2"));
router.post("/reset", (req, res) => proxyToWorker(req, res, "/api/dashboard/reset"));

// Config
router.get("/config", (req, res) => proxyToWorker(req, res, "/api/config"));
router.post("/config", (req, res) => proxyToWorker(req, res, "/api/config"));

export default router;
