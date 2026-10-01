import { describe, it, expect } from "vitest";
import {
  chunkText,
  normalize,
  buildContext,
  validateCitations,
  queryTerms,
} from "../src/server/retrieval/context";
import type { Chunk } from "../src/lib/types";
const chunk = (
  id: string,
  documentId: string,
  text: string,
  score = 1,
): Chunk => ({ id, documentId, text, score, title: documentId, ordinal: 0 });
describe("document context", () => {
  it("normalizes control characters and preserves paragraph structure", () => {
    expect(normalize("a\r\n\r\n\r\nb\u0000")).toBe("a\n\nb");
  });
  it("keeps prose intact while bounding oversized paragraphs", () => {
    const input = "Longword ".repeat(500);
    const pieces = chunkText(input, 200);
    expect(pieces.every((s) => s.length <= 200)).toBe(true);
    expect(pieces.join(" ").replace(/\s+/g, " ").trim()).toBe(input.trim());
  });
  it("does not produce blank chunks", () => {
    expect(chunkText("  \n ")).toEqual([]);
  });
  it("selects diverse documents before extra sections and removes duplicates", () => {
    const result = buildContext([
      chunk("1", "a", "alpha", 5),
      chunk("2", "a", "beta", 4),
      chunk("3", "b", "gamma", 3),
      chunk("4", "c", "alpha", 2),
    ]);
    expect(result.chunks.map((c) => c.id)).toEqual(["1", "3", "2"]);
  });
  it("never exceeds its estimated budget", () => {
    const result = buildContext(
      [chunk("1", "a", "x".repeat(900)), chunk("2", "b", "z".repeat(900))],
      350,
    );
    expect(result.tokens).toBeLessThanOrEqual(350);
    expect(result.chunks).toHaveLength(1);
  });
  it("does not force irrelevant or oversized evidence into context", () => {
    expect(buildContext([chunk("1", "a", "x", 0)]).chunks).toHaveLength(0);
    expect(
      buildContext([chunk("1", "a", "x".repeat(10000))], 20).chunks,
    ).toHaveLength(0);
  });
  it("rejects fabricated and missing citation references", () => {
    const { citations } = buildContext([chunk("1", "a", "facts")]);
    expect(() => validateCitations("Claim [9]", citations)).toThrow();
    expect(() => validateCitations("Uncited", citations)).toThrow();
    expect(validateCitations("Fact [1]", citations)).toHaveLength(1);
  });
  it("caps and sanitizes retrieval terms", () => {
    expect(queryTerms("the database'); DROP TABLE users; --")).toEqual([
      "database",
      "drop",
      "table",
      "users",
    ]);
    expect(queryTerms("the and for")).toEqual([]);
  });
});
