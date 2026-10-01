import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db/client";
import { tasks, runs } from "@/server/db/schema";
import { requireWorkspace, serializeRun } from "@/server/db/repository";
import { apiError, guard, HttpError, jsonBody } from "@/server/http";
import { executeRun } from "@/server/ai/orchestrator";
import type { StreamEvent } from "@/lib/types";
export const runtime = "nodejs";
export const maxDuration = 120;
export async function POST(request: Request) {
  try {
    guard(request);
    const input = z
      .object({
        workspaceId: z.uuid(),
        prompt: z.string().trim().min(8).max(2000),
        taskId: z.uuid().optional(),
        fault: z.boolean().optional(),
      })
      .parse(await jsonBody(request));
    await requireWorkspace(input.workspaceId);
    let task;
    if (input.taskId) {
      [task] = await db
        .select()
        .from(tasks)
        .where(
          and(
            eq(tasks.id, input.taskId),
            eq(tasks.workspaceId, input.workspaceId),
          ),
        );
      if (!task) throw new HttpError("Task not found.", 404);
    } else
      [task] = await db
        .insert(tasks)
        .values({ workspaceId: input.workspaceId, prompt: input.prompt })
        .returning();
    const [active] = await db
      .select({ id: runs.id })
      .from(runs)
      .where(and(eq(runs.taskId, task.id), eq(runs.status, "running")));
    if (active)
      throw new HttpError("This task already has a running execution.", 409);
    const provider =
      process.env.AI_MODE === "provider"
        ? (process.env.AI_PROVIDER ?? "openai-compatible")
        : "demo";
    let row;
    try {
      [row] = await db
        .insert(runs)
        .values({
          taskId: task.id,
          status: "running",
          provider,
          model:
            provider === "demo"
              ? "deterministic-v1"
              : (process.env.AI_MODEL ?? "unconfigured"),
        })
        .returning();
    } catch {
      throw new HttpError(
        "A run is already in progress. Refresh before retrying.",
        409,
      );
    }
    const run = serializeRun(row);
    const encoder = new TextEncoder();
    const disconnected = new AbortController();
    const signal = AbortSignal.any([
      request.signal,
      disconnected.signal,
      AbortSignal.timeout(90000),
    ]);
    const taskData = { ...task, createdAt: task.createdAt.toISOString() };
    const stream = new ReadableStream({
      async start(controller) {
        const emit = (event: StreamEvent) => {
          if (disconnected.signal.aborted) return;
          try {
            controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
          } catch {
            disconnected.abort();
          }
        };
        emit({ type: "run", run, task: taskData });
        try {
          await executeRun({
            run,
            workspaceId: input.workspaceId,
            prompt: task.prompt,
            signal,
            emit,
            fault: process.env.ENABLE_TEST_FAULTS === "true" && input.fault,
          });
        } catch {
          console.error(
            JSON.stringify({ event: "run_persistence_failed", runId: run.id }),
          );
        } finally {
          if (!disconnected.signal.aborted) {
            try {
              controller.close();
            } catch {
              disconnected.abort();
            }
          }
        }
      },
      cancel() {
        disconnected.abort();
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    return apiError(error);
  }
}
