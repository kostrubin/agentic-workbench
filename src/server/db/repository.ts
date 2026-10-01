import { createHash } from "node:crypto";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db, LOCAL_USER } from "./client";
import * as schema from "./schema";
import { chunkText, normalize, queryTerms } from "../retrieval/context";
import type { Bootstrap, Chunk, Run } from "../../lib/types";
export async function requireWorkspace(id: string) {
  const [workspace] = await db
    .select()
    .from(schema.workspaces)
    .where(
      and(
        eq(schema.workspaces.id, id),
        eq(schema.workspaces.ownerId, LOCAL_USER),
      ),
    );
  if (!workspace) throw new Error("Workspace not found.");
  return workspace;
}
export async function ingest(
  workspaceId: string,
  title: string,
  input: string,
  kind = "note",
) {
  await requireWorkspace(workspaceId);
  const content = normalize(input);
  if (content.length < 10 || content.length > 150000)
    throw new Error(
      "Documents must contain 10–150,000 characters of readable text.",
    );
  const hash = createHash("sha256").update(content).digest("hex");
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(schema.documents)
      .where(
        and(
          eq(schema.documents.workspaceId, workspaceId),
          eq(schema.documents.hash, hash),
        ),
      );
    if (existing) return existing;
    const [document] = await tx
      .insert(schema.documents)
      .values({ workspaceId, title, content, hash, kind })
      .returning();
    await tx.insert(schema.chunks).values(
      chunkText(content).map((text, ordinal) => ({
        documentId: document.id,
        ordinal,
        text,
      })),
    );
    return document;
  });
}
export async function searchWorkspace(
  workspaceId: string,
  query: string,
): Promise<Chunk[]> {
  await requireWorkspace(workspaceId);
  const terms = queryTerms(query);
  if (!terms.length) return [];
  const tsQuery = terms.join(" | ");
  const result = await db.execute(sql`
    SELECT c.id, c.document_id AS "documentId", d.title, c.text, c.ordinal,
      ts_rank_cd(to_tsvector('english', c.text), to_tsquery('english', ${tsQuery})) AS score
    FROM chunks c JOIN documents d ON d.id = c.document_id
    WHERE d.workspace_id = ${workspaceId}::uuid
      AND to_tsvector('english', c.text) @@ to_tsquery('english', ${tsQuery})
    ORDER BY score DESC, c.id LIMIT 40`);
  return result.rows as unknown as Chunk[];
}
export function serializeRun(run: typeof schema.runs.$inferSelect): Run {
  return {
    ...run,
    startedAt: run.startedAt.toISOString(),
    completedAt: run.completedAt?.toISOString() ?? null,
  };
}
export async function bootstrap(workspaceId?: string): Promise<Bootstrap> {
  const workspaces = await db
    .select()
    .from(schema.workspaces)
    .where(eq(schema.workspaces.ownerId, LOCAL_USER))
    .orderBy(schema.workspaces.createdAt);
  const activeWorkspace =
    workspaces.find((w) => w.id === workspaceId)?.id ?? workspaces[0]?.id ?? "";
  const documents = activeWorkspace
    ? await db
        .select()
        .from(schema.documents)
        .where(eq(schema.documents.workspaceId, activeWorkspace))
        .orderBy(schema.documents.createdAt)
    : [];
  const tasks = activeWorkspace
    ? await db
        .select()
        .from(schema.tasks)
        .where(eq(schema.tasks.workspaceId, activeWorkspace))
        .orderBy(desc(schema.tasks.createdAt))
        .limit(50)
    : [];
  // The request-bound runner has a 90s deadline. Recover runs abandoned by a terminated process.
  if (tasks.length)
    await db
      .update(schema.runs)
      .set({
        status: "failed",
        error: "Execution was interrupted. Retry to start a fresh run.",
        completedAt: new Date(),
      })
      .where(
        and(
          inArray(
            schema.runs.taskId,
            tasks.map((t) => t.id),
          ),
          eq(schema.runs.status, "running"),
          sql`${schema.runs.startedAt} < now() - interval '2 minutes'`,
        ),
      );
  const runs = tasks.length
    ? await db
        .select()
        .from(schema.runs)
        .where(
          inArray(
            schema.runs.taskId,
            tasks.map((t) => t.id),
          ),
        )
        .orderBy(desc(schema.runs.startedAt))
    : [];
  return {
    workspaces: workspaces.map(({ id, name, description }) => ({
      id,
      name,
      description,
    })),
    activeWorkspace,
    documents: documents.map((d) => ({
      id: d.id,
      title: d.title,
      kind: d.kind,
      content: d.content,
      createdAt: d.createdAt.toISOString(),
    })),
    tasks: tasks.map((t) => ({
      ...t,
      createdAt: t.createdAt.toISOString(),
      runs: runs.filter((r) => r.taskId === t.id).map(serializeRun),
    })),
    config: {
      mode: process.env.AI_MODE === "provider" ? "provider" : "demo",
      model:
        process.env.AI_MODE === "provider"
          ? (process.env.AI_MODEL ?? "unconfigured")
          : "Deterministic v1",
      mcp: Boolean(process.env.MCP_URL),
    },
  };
}
