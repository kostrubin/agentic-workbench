import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../db/client";
import { runs, toolExecutions } from "../db/schema";
import { buildContext, validateCitations } from "../retrieval/context";
import { nativeTools, withTimeout } from "../tools/registry";
import { mcpCalculator } from "../tools/mcp";
import { getProvider, type Provider } from "./provider";
import type { Activity, Phase, Run, StreamEvent } from "../../lib/types";
interface Options {
  run: Run;
  workspaceId: string;
  prompt: string;
  signal: AbortSignal;
  emit: (event: StreamEvent) => void;
  fault?: boolean;
  provider?: Provider;
}
export async function executeRun({
  run,
  workspaceId,
  prompt,
  signal,
  emit,
  fault,
  provider,
}: Options): Promise<Run> {
  const started = Date.now();
  const tools = nativeTools(workspaceId);
  const persist = async () => {
    await db
      .update(runs)
      .set({
        ...run,
        startedAt: new Date(run.startedAt),
        completedAt: run.completedAt ? new Date(run.completedAt) : null,
      })
      .where(eq(runs.id, run.id));
  };
  const activity = async <T>(
    phase: Phase,
    label: string,
    work: () => Promise<T>,
    tool?: string,
    optional = false,
  ): Promise<T | undefined> => {
    signal.throwIfAborted();
    const item: Activity = {
      id: randomUUID(),
      phase,
      label,
      status: "running",
      tool,
    };
    run.activities.push(item);
    emit({ type: "activity", activity: { ...item } });
    const time = Date.now();
    try {
      const result = await work();
      item.status = "completed";
      if (
        result &&
        typeof result === "object" &&
        "expression" in result &&
        "value" in result
      )
        item.detail = `${result.expression} = ${result.value}`;
      return result;
    } catch (error) {
      item.status = "failed";
      item.detail = optional
        ? "Optional integration unavailable; native tools remain available."
        : "This step could not complete.";
      if (!optional) throw error;
    } finally {
      item.durationMs = Date.now() - time;
      emit({ type: "activity", activity: { ...item } });
      if (tool)
        await db.insert(toolExecutions).values({
          id: item.id,
          runId: run.id,
          name: tool,
          status: item.status,
          durationMs: item.durationMs,
          summary: item.detail ?? item.label,
        });
      await persist();
    }
  };
  try {
    const ai = provider ?? getProvider();
    const plan = await activity("plan", "Define the research plan", () =>
      ai.plan(prompt, signal),
    );
    if (!plan) throw new Error("Planning failed.");
    const candidates = await activity(
      "retrieve",
      "Search workspace sources",
      () =>
        withTimeout(
          (s) => tools.searchWorkspace.execute({ query: plan.query }, s),
          signal,
        ),
      "searchWorkspace",
    );
    if (fault) throw new Error("Simulated interruption");
    const context = buildContext(candidates ?? []);
    run.retrievalCount = candidates?.length ?? 0;
    run.contextTokens = context.tokens;
    run.citations = context.citations;
    emit({ type: "citations", citations: run.citations });
    const outputs: unknown[] = [];
    if (context.chunks.length)
      await activity(
        "retrieve",
        `Read ${context.chunks.length} selected passages`,
        () =>
          withTimeout(
            (s) =>
              tools.retrieveDocumentSections.execute(
                { chunkIds: context.chunks.map((c) => c.id) },
                s,
              ),
            signal,
          ),
        "retrieveDocumentSections",
      );
    if (plan.compare && context.citations.length >= 2) {
      const comparison = await activity(
        "tools",
        "Compare the source constraints",
        () =>
          withTimeout(
            (s) =>
              tools.compareSources.execute(
                {
                  sources: context.citations.map((c) => ({
                    title: c.title,
                    excerpt: c.excerpt,
                  })),
                },
                s,
              ),
            signal,
          ),
        "compareSources",
      );
      if (comparison) outputs.push(comparison);
    }
    if (plan.currentTime)
      outputs.push(
        await activity(
          "tools",
          "Read the current UTC time",
          () => tools.getCurrentDateTime.execute({}, signal),
          "getCurrentDateTime",
        ),
      );
    const arithmetic =
      plan.calculator ??
      (context.text.includes("40 requests per second") &&
      context.text.includes("10x")
        ? { a: 40, b: 10, operation: "multiply" as const }
        : null);
    if (arithmetic) {
      const result = await activity(
        "tools",
        "Verify the numbers",
        () =>
          withTimeout((s) => tools.calculator.execute(arithmetic, s), signal),
        "calculator",
        true,
      );
      if (result) outputs.push(result);
      else
        outputs.push({
          error: "Calculator failed. Do not invent an arithmetic result.",
        });
      if (process.env.MCP_URL) {
        const remote = await activity(
          "tools",
          "Cross-check via MCP",
          () => withTimeout((s) => mcpCalculator(arithmetic, s), signal),
          "mcp.calculator",
          true,
        );
        if (remote) outputs.push({ mcpVerified: remote.value });
      }
    }
    await activity("synthesize", "Prepare the cited synthesis", async () => {
      const stream = ai.synthesize(
        { prompt, citations: context.citations, toolResults: outputs },
        signal,
      );
      let lastCheckpoint = Date.now();
      while (true) {
        signal.throwIfAborted();
        const next = await stream.next();
        if (next.done) {
          run.usage = next.value;
          break;
        }
        run.answer += next.value;
        if (run.answer.length > 24000)
          throw new Error("Output limit exceeded.");
        emit({ type: "delta", text: next.value });
        if (Date.now() - lastCheckpoint > 1000) {
          await persist();
          lastCheckpoint = Date.now();
        }
      }
      if (!run.answer.trim())
        throw new Error("Provider returned an empty result.");
      run.citations = validateCitations(run.answer, context.citations);
    });
    run.status = "completed";
  } catch {
    run.status =
      signal.aborted && signal.reason?.name !== "TimeoutError"
        ? "cancelled"
        : "failed";
    run.error =
      run.status === "cancelled"
        ? "Run cancelled. Partial output is retained."
        : "The run could not complete. Check provider configuration or retry. Partial output is unverified.";
    // Log only identifiers/status, not raw provider exceptions, source text, or credentials.
    console.error(
      JSON.stringify({
        event: "run_failed",
        runId: run.id,
        status: run.status,
      }),
    );
  }
  run.completedAt = new Date().toISOString();
  run.latencyMs = Date.now() - started;
  await persist();
  emit({ type: "done", run });
  console.info(
    JSON.stringify({
      event: "run_finished",
      runId: run.id,
      status: run.status,
      latencyMs: run.latencyMs,
      contextTokens: run.contextTokens,
    }),
  );
  return run;
}
