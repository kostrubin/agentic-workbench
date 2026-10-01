import {
  pgTable,
  text,
  uuid,
  timestamp,
  integer,
  jsonb,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import type { Activity, Citation, RunStatus } from "../../lib/types";
export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
});
export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => users.id),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
export const documents = pgTable(
  "documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    workspaceId: uuid("workspace_id")
      .notNull()
      .references(() => workspaces.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    kind: text("kind").notNull(),
    content: text("content").notNull(),
    hash: text("hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [uniqueIndex("documents_workspace_hash").on(t.workspaceId, t.hash)],
);
export const chunks = pgTable(
  "chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    documentId: uuid("document_id")
      .notNull()
      .references(() => documents.id, { onDelete: "cascade" }),
    ordinal: integer("ordinal").notNull(),
    text: text("text").notNull(),
  },
  (t) => [index("chunks_document_idx").on(t.documentId)],
);
export const tasks = pgTable("tasks", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id")
    .notNull()
    .references(() => workspaces.id, { onDelete: "cascade" }),
  prompt: text("prompt").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
export const runs = pgTable(
  "runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    taskId: uuid("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    status: text("status").$type<RunStatus>().notNull(),
    answer: text("answer").notNull().default(""),
    activities: jsonb("activities").$type<Activity[]>().notNull().default([]),
    citations: jsonb("citations").$type<Citation[]>().notNull().default([]),
    provider: text("provider").notNull(),
    model: text("model").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    latencyMs: integer("latency_ms"),
    contextTokens: integer("context_tokens").notNull().default(0),
    retrievalCount: integer("retrieval_count").notNull().default(0),
    usage: jsonb("usage").$type<{
      inputTokens?: number;
      outputTokens?: number;
    }>(),
    error: text("error"),
  },
  (t) => [index("runs_task_idx").on(t.taskId)],
);
export const toolExecutions = pgTable("tool_executions", {
  id: uuid("id").primaryKey(),
  runId: uuid("run_id")
    .notNull()
    .references(() => runs.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  status: text("status").notNull(),
  durationMs: integer("duration_ms").notNull(),
  summary: text("summary").notNull(),
});
