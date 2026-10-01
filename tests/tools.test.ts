import { describe, it, expect } from "vitest";
import {
  calculate,
  calculatorInput,
  nativeTools,
  withTimeout,
} from "../src/server/tools/registry";
import { demoPlan, demoAnswer, planSchema } from "../src/server/ai/provider";
import {
  buildContext,
  chunkText,
  validateCitations,
} from "../src/server/retrieval/context";
import { seedDocuments, examplePrompt } from "../src/server/seed-content";
describe("typed tools and planning", () => {
  it("accepts the maximum user prompt while bounding the retrieval query", () => {
    const plan = demoPlan("architecture ".repeat(200).slice(0, 2000));
    expect(plan.query).toHaveLength(1500);
  });
  it("selects arithmetic for explicit operands", () => {
    expect(demoPlan("Calculate 40 * 10").calculator).toEqual({
      a: 40,
      b: 10,
      operation: "multiply",
    });
    expect(calculate({ a: 40, b: 10, operation: "multiply" }).value).toBe(400);
  });
  it("rejects division by zero and non-finite or out-of-bound numbers", () => {
    expect(() => calculate({ a: 1, b: 0, operation: "divide" })).toThrow(
      "zero",
    );
    expect(
      calculatorInput.safeParse({ a: Infinity, b: 1, operation: "add" })
        .success,
    ).toBe(false);
    expect(
      calculatorInput.safeParse({ a: 1e13, b: 1, operation: "add" }).success,
    ).toBe(false);
  });
  it("rejects executable expressions and unsupported tool operations", () => {
    expect(
      calculatorInput.safeParse({
        a: "process.exit()",
        b: 1,
        operation: "eval",
      }).success,
    ).toBe(false);
    expect(
      planSchema.safeParse({
        query: "x",
        compare: true,
        calculator: { operation: "shell" },
      }).success,
    ).toBe(false);
  });
  it("validates tool arguments at the registry boundary", async () => {
    await expect(
      nativeTools("unused").calculator.execute(
        { a: "1", b: 2, operation: "add" },
        new AbortController().signal,
      ),
    ).rejects.toThrow();
  });
  it("bounds stalled tools and propagates pre-existing cancellation", async () => {
    await expect(
      withTimeout(
        () => new Promise(() => {}),
        new AbortController().signal,
        10,
      ),
    ).rejects.toThrow("timed out");
    const c = new AbortController();
    c.abort();
    await expect(withTimeout(async () => 1, c.signal)).rejects.toThrow();
  });
  it("produces source-valid seeded synthesis without manufacturing citations", () => {
    const chunks = seedDocuments.flatMap((d, i) =>
      chunkText(d.content).map((text, j) => ({
        id: `${i}-${j}`,
        documentId: String(i),
        title: d.title,
        text,
        ordinal: j,
        score: 1,
      })),
    );
    const context = buildContext(chunks);
    const answer = demoAnswer({
      prompt: examplePrompt,
      citations: context.citations,
      toolResults: [],
    });
    expect(answer).toContain("Start with a modular monolith");
    expect(
      validateCitations(answer, context.citations).length,
    ).toBeGreaterThanOrEqual(4);
  });
  it("handles absent evidence honestly", () => {
    expect(
      demoAnswer({ prompt: "unknown", citations: [], toolResults: [] }),
    ).toContain("No matching evidence");
  });
});
