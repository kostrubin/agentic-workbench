import { afterAll, beforeAll, describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db, pool, LOCAL_USER } from "../src/server/db/client";
import {
  users,
  workspaces,
  documents,
  tasks,
  runs,
  toolExecutions,
} from "../src/server/db/schema";
import {
  ingest,
  searchWorkspace,
  serializeRun,
} from "../src/server/db/repository";
import { seedDocuments, examplePrompt } from "../src/server/seed-content";
import { executeRun } from "../src/server/ai/orchestrator";
import { demoAnswer, demoPlan, type Provider } from "../src/server/ai/provider";
import type { StreamEvent } from "../src/lib/types";
const workspaceId = randomUUID(),
  otherId = randomUUID();
const fast: Provider = {
  name: "test",
  model: "fixture",
  async plan(p) {
    return demoPlan(p);
  },
  async *synthesize(input) {
    yield demoAnswer(input);
    return {};
  },
};
async function run(
  prompt = examplePrompt,
  options: { fault?: boolean; signal?: AbortSignal; provider?: Provider } = {},
) {
  const [task] = await db
    .insert(tasks)
    .values({ workspaceId, prompt })
    .returning();
  const [row] = await db
    .insert(runs)
    .values({
      taskId: task.id,
      status: "running",
      provider: "demo",
      model: "test",
    })
    .returning();
  const events: StreamEvent[] = [];
  const result = await executeRun({
    run: serializeRun(row),
    workspaceId,
    prompt,
    signal: options.signal ?? new AbortController().signal,
    emit: (e) => events.push(e),
    provider: options.provider ?? fast,
    fault: options.fault,
  });
  return { result, events };
}
beforeAll(async () => {
  await db
    .insert(users)
    .values({ id: LOCAL_USER, name: "Local reviewer" })
    .onConflictDoNothing();
  await db.insert(workspaces).values([
    { id: workspaceId, ownerId: LOCAL_USER, name: "Integration test" },
    { id: otherId, ownerId: LOCAL_USER, name: "Isolation test" },
  ]);
  for (const d of seedDocuments)
    await ingest(workspaceId, d.title, d.content, d.kind);
  await ingest(
    otherId,
    "Secret marker",
    "Isolated confidential zebracorn architecture",
  );
});
afterAll(async () => {
  await db.delete(workspaces).where(eq(workspaces.id, workspaceId));
  await db.delete(workspaces).where(eq(workspaces.id, otherId));
  await pool.end();
});
describe("PostgreSQL-backed execution", () => {
  it("deduplicates ingestion and isolates retrieval to the authorized workspace", async () => {
    await ingest(workspaceId, seedDocuments[0].title, seedDocuments[0].content);
    expect(
      await db
        .select()
        .from(documents)
        .where(eq(documents.workspaceId, workspaceId)),
    ).toHaveLength(4);
    expect(await searchWorkspace(workspaceId, "zebracorn")).toHaveLength(0);
    expect(
      (await searchWorkspace(workspaceId, "Kafka")).some((c) =>
        c.title.includes("Proposal B"),
      ),
    ).toBe(true);
  });
  it("persists complete runs, citations, streamed deltas, and tool timings", async () => {
    const { result, events } = await run();
    expect(result.status).toBe("completed");
    expect(result.answer).toContain("modular monolith");
    expect(result.citations.length).toBeGreaterThan(3);
    expect(events.some((e) => e.type === "delta")).toBe(true);
    const executions = await db
      .select()
      .from(toolExecutions)
      .where(eq(toolExecutions.runId, result.id));
    expect(executions.map((t) => t.name)).toContain("calculator");
    const [saved] = await db.select().from(runs).where(eq(runs.id, result.id));
    expect(saved.answer).toBe(result.answer);
  });
  it("records a failed attempt and supports a clean retry execution", async () => {
    const { result } = await run(examplePrompt, { fault: true });
    expect(result.status).toBe("failed");
    expect(result.error).not.toContain("Simulated");
    const [row] = await db
      .insert(runs)
      .values({
        taskId: result.taskId,
        status: "running",
        provider: "demo",
        model: "test",
      })
      .returning();
    const retried = await executeRun({
      run: serializeRun(row),
      workspaceId,
      prompt: examplePrompt,
      signal: new AbortController().signal,
      emit: () => {},
      provider: fast,
    });
    expect(retried.status).toBe("completed");
  });
  it("rejects concurrent active runs for the same task", async () => {
    const [task] = await db
      .insert(tasks)
      .values({ workspaceId, prompt: "Concurrent run test" })
      .returning();
    await db.insert(runs).values({
      taskId: task.id,
      status: "running",
      provider: "demo",
      model: "test",
    });
    await expect(
      db.insert(runs).values({
        taskId: task.id,
        status: "running",
        provider: "demo",
        model: "test",
      }),
    ).rejects.toThrow();
  });
  it("records cancellation as a terminal status", async () => {
    const controller = new AbortController();
    controller.abort();
    expect(
      (await run(examplePrompt, { signal: controller.signal })).result.status,
    ).toBe("cancelled");
  });
  it("isolates calculator failure while completing the evidence brief", async () => {
    const { result } = await run(
      "Calculate 40 / 0 and compare architecture proposals",
    );
    expect(result.status).toBe("completed");
    expect(
      result.activities.some(
        (a) => a.tool === "calculator" && a.status === "failed",
      ),
    ).toBe(true);
  });
  it("marks an answer with fabricated citations failed", async () => {
    const bad: Provider = {
      ...fast,
      async *synthesize() {
        yield "Invented claim [999]";
        return {};
      },
    };
    expect((await run(examplePrompt, { provider: bad })).result.status).toBe(
      "failed",
    );
  });
});
