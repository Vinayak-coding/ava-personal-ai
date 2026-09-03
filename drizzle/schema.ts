import { index, int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const conversations = mysqlTable("conversations", { id: int("id").autoincrement().primaryKey(), userId: int("userId").notNull(), title: varchar("title", { length: 180 }).notNull().default("New conversation"), createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull() }, table => ({ userIdIdx: index("conversations_userId_idx").on(table.userId) }));
export const messages = mysqlTable("messages", { id: int("id").autoincrement().primaryKey(), conversationId: int("conversationId").notNull(), role: mysqlEnum("role", ["user", "assistant"]).notNull(), content: text("content").notNull(), createdAt: timestamp("createdAt").defaultNow().notNull() }, table => ({ conversationIdIdx: index("messages_conversationId_idx").on(table.conversationId) }));
export const tasks = mysqlTable("tasks", { id: int("id").autoincrement().primaryKey(), userId: int("userId").notNull(), title: varchar("title", { length: 240 }).notNull(), notes: text("notes"), status: mysqlEnum("status", ["todo", "in_progress", "done"]).notNull().default("todo"), priority: mysqlEnum("priority", ["low", "medium", "high"]).notNull().default("medium"), dueAt: timestamp("dueAt"), createdAt: timestamp("createdAt").defaultNow().notNull(), updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull() }, table => ({ userIdIdx: index("tasks_userId_idx").on(table.userId), statusIdx: index("tasks_status_idx").on(table.status) }));

export const briefingSettings = mysqlTable("briefing_settings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  timeZone: varchar("timeZone", { length: 64 }).notNull().default("Asia/Kolkata"),
  hour: int("hour").notNull().default(8),
  minute: int("minute").notNull().default(30),
  enabled: int("enabled").notNull().default(1),
  scheduleCronTaskUid: varchar("schedule_cron_task_uid", { length: 65 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, table => ({ userIdUnique: uniqueIndex("briefing_settings_userId_unique").on(table.userId), taskUidIdx: index("briefing_settings_task_uid_idx").on(table.scheduleCronTaskUid) }));

export const briefings = mysqlTable("briefings", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  briefingDate: varchar("briefing_date", { length: 10 }).notNull(),
  content: text("content").notNull(),
  taskCount: int("task_count").notNull().default(0),
  eventCount: int("event_count").notNull().default(0),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, table => ({ userDateUnique: uniqueIndex("briefings_user_date_unique").on(table.userId, table.briefingDate), userIdIdx: index("briefings_userId_idx").on(table.userId) }));

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type Conversation = typeof conversations.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Task = typeof tasks.$inferSelect;
export type BriefingSetting = typeof briefingSettings.$inferSelect;
export type Briefing = typeof briefings.$inferSelect;
