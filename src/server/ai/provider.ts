import { z } from "zod";
import { generateText, streamText, Output } from "ai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { setTimeout as delay } from "node:timers/promises";
import { calculatorInput } from "../tools/registry";
import { plannerPrompt, synthesisPrompt } from "./prompts";
import type { Citation } from "../../lib/types";
export const planSchema = z.object({
  query: z.string().min(1).max(1500),
  compare: z.boolean(),
  calculator: calculatorInput.nullable(),
  currentTime: z.boolean(),
});
export type Plan = z.infer<typeof planSchema>;
export interface SynthesisInput {
  prompt: string;
  citations: Citation[];
  toolResults: unknown[];
}
export interface Provider {
  name: string;
  model: string;
  plan(prompt: string, signal: AbortSignal): Promise<Plan>;
  synthesize(
    input: SynthesisInput,
    signal: AbortSignal,
  ): AsyncGenerator<string, { inputTokens?: number; outputTokens?: number }>;
}
export function demoPlan(prompt: string): Plan {
  const expression = prompt.match(
    /(-?\d+(?:\.\d+)?)\s*([+*/×−-])\s*(-?\d+(?:\.\d+)?)/,
  );
  const operations = {
    "+": "add",
    "-": "subtract",
    "−": "subtract",
    "*": "multiply",
    "×": "multiply",
    "/": "divide",
  } as const;
  return planSchema.parse({
    query: prompt,
    compare: /compar|proposal|trade.?off/i.test(prompt),
    currentTime: /current (date|time)|today.s date/i.test(prompt),
    calculator: expression
      ? {
          a: Number(expression[1]),
          b: Number(expression[3]),
          operation: operations[expression[2] as keyof typeof operations],
        }
      : null,
  });
}
export function demoAnswer({ citations, toolResults }: SynthesisInput): string {
  const citeContaining = (text: string) =>
    citations.find((c) => c.excerpt.includes(text));
  const a = citeContaining("Estimated baseline monthly cost is $650");
  const b = citeContaining("Estimated baseline monthly cost is $1,850");
  const constraints = citeContaining("four full-stack engineers");
  const risk = citeContaining(
    "Neither proposal includes a representative load test",
  );
  let answer: string;
  if (a && b && constraints && risk) {
    answer = `## Start with a modular monolith\n\nFor Northstar, choose **Proposal A**, with a durable background queue for reporting. The four-engineer team and eight-week launch favor a smaller operational surface. Independent services bring useful isolation, but their additional operating burden is difficult to justify at this stage. [${constraints.label}] [${a.label}] [${b.label}]\n\n### The decision, in context\n\n| Criterion | Modular monolith | Event-driven services |\n| --- | --- | --- |\n| Baseline cost estimate | $650 / month | $1,850 / month |\n| Operating model | One release pipeline | Kafka, Kubernetes, multiple services |\n| Primary trade-off | Coupled releases and shared blast radius | Operational complexity and eventual consistency |\n\nThese are proposal estimates, not measured production costs. The service proposal excludes additional observability and transfer costs. [${a.label}] [${b.label}]\n\n### Scale the workload before the organization\n\nMove expensive report generation to a worker, keep domain boundaries explicit, and test the target workload before promising capacity. **Neither proposal has demonstrated the 10× target in a representative load test.** [${risk.label}]\n\n### What would change this decision?\n\nRevisit service extraction when separate teams own domains, release coupling measurably blocks delivery, or a workload needs independent scaling. Record p95 latency, queue depth, database saturation, and errors during load tests. [${risk.label}]`;
  } else if (citations.length) {
    const unique = citations.filter(
      (c, i) => citations.findIndex((s) => s.documentId === c.documentId) === i,
    );
    answer =
      `## Evidence brief\n\nThis deterministic demo selects excerpts from your sources. Use provider mode for an open-ended interpretation of your question.\n\n` +
      unique
        .map(
          (c) =>
            `### ${c.title.replace(/[\[\]<>]/g, "")}\n\n${c.excerpt
              .replace(/^#+\s.*$/gm, "")
              .trim()
              .slice(0, 650)} [${c.label}]`,
        )
        .join("\n\n") +
      "\n\n### Next step\n\nCheck the source excerpts against your decision criteria. Retrieved evidence may be incomplete; absence of a matching passage is not evidence that a constraint does not exist.";
  } else
    answer =
      "## No matching evidence\n\nI could not find relevant passages in this workspace. Add a document or use terms that appear in your sources, then run the task again. I cannot support a source-based recommendation with the current context.";
  const calculations = toolResults.filter(
    (t): t is { expression: string; value: number } =>
      typeof t === "object" && t !== null && "expression" in t && "value" in t,
  );
  if (calculations.length)
    answer +=
      "\n\n### Verified arithmetic\n\n" +
      calculations
        .map(
          (c) =>
            `- ${c.expression} = **${c.value.toLocaleString("en-US")}** (calculator)`,
        )
        .join("\n");
  const clock = toolResults.find(
    (t): t is { iso: string } =>
      typeof t === "object" && t !== null && "iso" in t,
  );
  if (clock) answer += `\n\n### Current time\n\n${clock.iso} (UTC, clock tool)`;
  return answer;
}
export function getProvider(): Provider {
  if (process.env.AI_MODE !== "provider")
    return {
      name: "demo",
      model: "deterministic-v1",
      async plan(prompt, signal) {
        await delay(220, undefined, { signal });
        return demoPlan(prompt);
      },
      async *synthesize(input, signal) {
        for (const word of demoAnswer(input).match(/\S+\s*/g) ?? []) {
          signal.throwIfAborted();
          await delay(12, undefined, { signal });
          yield word;
        }
        return {};
      },
    };
  if (!process.env.AI_API_KEY || !process.env.AI_MODEL)
    throw new Error("Provider configuration is incomplete.");
  const modelName = process.env.AI_MODEL;
  const compatible = createOpenAICompatible({
    supportsStructuredOutputs: true,
    includeUsage: true,
    name: process.env.AI_PROVIDER ?? "openai-compatible",
    apiKey: process.env.AI_API_KEY,
    baseURL: process.env.AI_BASE_URL ?? "https://api.openai.com/v1",
  });
  const model = compatible.chatModel(modelName);
  let planningUsage: { inputTokens?: number; outputTokens?: number } = {};
  return {
    name: process.env.AI_PROVIDER ?? "openai-compatible",
    model: modelName,
    async plan(prompt, signal) {
      const result = await generateText({
        model,
        instructions: plannerPrompt,
        prompt,
        output: Output.object({ schema: planSchema }),
        maxOutputTokens: 500,
        maxRetries: 2,
        abortSignal: signal,
      });
      planningUsage = result.usage;
      return planSchema.parse(result.output);
    },
    async *synthesize(input, signal) {
      const result = streamText({
        model,
        instructions: synthesisPrompt,
        prompt: JSON.stringify({
          task: input.prompt,
          untrustedEvidence: input.citations,
          calculatorAndComparisonResults: input.toolResults,
        }),
        maxOutputTokens: 2200,
        maxRetries: 2,
        abortSignal: signal,
      });
      // Only public text deltas are consumed. Reasoning parts are never persisted or forwarded.
      for await (const part of result.fullStream) {
        if (part.type === "text-delta") yield part.text;
        if (part.type === "error")
          throw new Error("Provider synthesis failed.");
      }
      const usage = await result.totalUsage;
      return {
        inputTokens:
          (usage.inputTokens ?? 0) + (planningUsage.inputTokens ?? 0),
        outputTokens:
          (usage.outputTokens ?? 0) + (planningUsage.outputTokens ?? 0),
      };
    },
  };
}
