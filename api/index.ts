import "dotenv/config";
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "../server/_core/oauth";
import { registerStorageProxy } from "../server/_core/storageProxy";
import { appRouter } from "../server/routers";
import { createContext } from "../server/_core/context";
import { generateDailyBriefing, type CalendarEvent } from "../server/briefing";
import { getBriefingSettingsByTaskUid, listPendingTasks } from "../server/db";
import { sdk } from "../server/_core/sdk";

const app = express();
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

app.use(
  "/api/trpc",
  createExpressMiddleware({ router: appRouter, createContext })
);

export default app;
