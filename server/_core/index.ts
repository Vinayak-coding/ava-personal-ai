import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageProxy } from "./storageProxy";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { generateDailyBriefing, type CalendarEvent } from "../briefing";
import { getBriefingSettingsByTaskUid, listPendingTasks } from "../db";
import { sdk } from "./sdk";
import { serveStatic, setupVite } from "./vite";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerStorageProxy(app);
  registerOAuthRoutes(app);
  app.post("/api/scheduled/daily-briefing", async (req, res) => {
    try {
      const user = await sdk.authenticateRequest(req);
      if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
      const settings = await getBriefingSettingsByTaskUid(user.taskUid);
      if (!settings) return res.json({ ok: true, skipped: "orphan" });
      const action = req.body?.action ?? "context";
      if (action === "context") {
        const pendingTasks = await listPendingTasks(settings.userId);
        return res.json({ ok: true, briefingDate: req.body?.briefingDate ?? null, pendingTasks });
      }
      if (action !== "publish") return res.status(400).json({ error: "unsupported-action" });
      const briefingDate = typeof req.body?.briefingDate === "string" ? req.body.briefingDate : "";
      if (!/^\d{4}-\d{2}-\d{2}$/.test(briefingDate)) return res.status(400).json({ error: "briefingDate must be YYYY-MM-DD" });
      const events = Array.isArray(req.body?.calendarEvents) ? req.body.calendarEvents as CalendarEvent[] : [];
      const briefing = await generateDailyBriefing(settings.userId, briefingDate, events);
      return res.json({ ok: true, briefingId: briefing?.id ?? null });
    } catch (error) {
      return res.status(500).json({ error: String(error), timestamp: new Date().toISOString() });
    }
  });
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
