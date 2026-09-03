import { and, desc, eq, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  briefings,
  briefingSettings,
  conversations,
  InsertUser,
  messages,
  tasks,
  users,
} from "../drizzle/schema";
import { ENV } from "./_core/env";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;

  for (const field of textFields) {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  }
  if (user.lastSignedIn !== undefined) {
    values.lastSignedIn = user.lastSignedIn;
    updateSet.lastSignedIn = user.lastSignedIn;
  }
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();

  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export async function listConversations(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(conversations)
    .where(eq(conversations.userId, userId))
    .orderBy(desc(conversations.updatedAt))
    .limit(30);
}

export async function getConversation(userId: number, conversationId: number) {
  const db = await getDb();
  if (!db) return { conversation: undefined, messages: [] };
  const conversation = await db
    .select()
    .from(conversations)
    .where(and(eq(conversations.id, conversationId), eq(conversations.userId, userId)))
    .limit(1);
  if (!conversation[0]) return { conversation: undefined, messages: [] };
  const conversationMessages = await db
    .select()
    .from(messages)
    .where(eq(messages.conversationId, conversationId))
    .orderBy(messages.createdAt)
    .limit(100);
  return { conversation: conversation[0], messages: conversationMessages };
}

export async function createConversation(userId: number, title = "New conversation") {
  const db = await getDb();
  if (!db) return undefined;
  const inserted = await db.insert(conversations).values({ userId, title });
  const id = Number(inserted[0].insertId);
  const result = await db.select().from(conversations).where(eq(conversations.id, id)).limit(1);
  return result[0];
}

export async function saveMessage(conversationId: number, role: "user" | "assistant", content: string) {
  const db = await getDb();
  if (!db) return;
  await db.insert(messages).values({ conversationId, role, content });
}

export async function renameConversation(conversationId: number, title: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(conversations).set({ title }).where(eq(conversations.id, conversationId));
}

export async function listTasks(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(tasks)
    .where(eq(tasks.userId, userId))
    .orderBy(desc(tasks.createdAt))
    .limit(50);
}

export async function createTask(
  userId: number,
  values: { title: string; notes?: string; priority?: "low" | "medium" | "high"; dueAt?: Date }
) {
  const db = await getDb();
  if (!db) return undefined;
  const inserted = await db.insert(tasks).values({ userId, ...values });
  const id = Number(inserted[0].insertId);
  const result = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
  return result[0];
}

export async function updateTaskStatus(userId: number, taskId: number, status: "todo" | "in_progress" | "done") {
  const db = await getDb();
  if (!db) return undefined;
  await db.update(tasks).set({ status }).where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)));
  const result = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, taskId), eq(tasks.userId, userId)))
    .limit(1);
  return result[0];
}

export async function getTasksByIds(userId: number, ids: number[]) {
  const db = await getDb();
  if (!db || ids.length === 0) return [];
  return db
    .select()
    .from(tasks)
    .where(and(eq(tasks.userId, userId), inArray(tasks.id, ids)))
    .limit(50);
}

export async function listPendingTasks(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(tasks)
    .where(and(eq(tasks.userId, userId), inArray(tasks.status, ["todo", "in_progress"])))
    .orderBy(desc(tasks.priority), desc(tasks.dueAt), desc(tasks.createdAt))
    .limit(50);
}

export async function getBriefingSettings(userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(briefingSettings).where(eq(briefingSettings.userId, userId)).limit(1);
  return result[0];
}

export async function getBriefingSettingsByTaskUid(taskUid: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(briefingSettings).where(eq(briefingSettings.scheduleCronTaskUid, taskUid)).limit(1);
  return result[0];
}

export async function upsertBriefingSettings(userId: number, values: { timeZone?: string; hour?: number; minute?: number; enabled?: number; scheduleCronTaskUid?: string | null }) {
  const db = await getDb();
  if (!db) return undefined;
  await db.insert(briefingSettings).values({ userId, ...values }).onDuplicateKeyUpdate({ set: values });
  return getBriefingSettings(userId);
}

export async function listBriefings(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(briefings).where(eq(briefings.userId, userId)).orderBy(desc(briefings.briefingDate)).limit(14);
}

export async function getBriefingByDate(userId: number, briefingDate: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(briefings).where(and(eq(briefings.userId, userId), eq(briefings.briefingDate, briefingDate))).limit(1);
  return result[0];
}

export async function saveBriefing(values: { userId: number; briefingDate: string; content: string; taskCount: number; eventCount: number }) {
  const db = await getDb();
  if (!db) return undefined;
  await db.insert(briefings).values(values).onDuplicateKeyUpdate({ set: { content: values.content, taskCount: values.taskCount, eventCount: values.eventCount } });
  return getBriefingByDate(values.userId, values.briefingDate);
}
