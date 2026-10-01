import { z } from "zod";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db/client";
import { chunks, documents } from "../db/schema";
import { queryTerms } from "../retrieval/context";
import { ingest, requireWorkspace, searchWorkspace } from "../db/repository";
import { calculatorInput, calculate } from "./calculator";
export { calculatorInput, calculate } from "./calculator";
function defineTool<I extends z.ZodType, O>(
  description: string,
  schema: I,
  execute: (input: z.infer<I>, signal: AbortSignal) => Promise<O> | O,
) {
  return {
    description,
    schema,
    async execute(raw: unknown, signal: AbortSignal): Promise<O> {
      signal.throwIfAborted();
      return execute(schema.parse(raw), signal);
    },
  };
}
export function nativeTools(workspaceId: string) {
  return {
    searchWorkspace: defineTool(
      "Search workspace sources",
      z.object({ query: z.string().min(1).max(2000) }),
      (input) => searchWorkspace(workspaceId, input.query),
    ),
    retrieveDocumentSections: defineTool(
      "Read selected document sections",
      z.object({ chunkIds: z.array(z.uuid()).min(1).max(8) }),
      async (input) => {
        await requireWorkspace(workspaceId);
        return db
          .select({ id: chunks.id, text: chunks.text, title: documents.title })
          .from(chunks)
          .innerJoin(documents, eq(chunks.documentId, documents.id))
          .where(
            and(
              eq(documents.workspaceId, workspaceId),
              inArray(chunks.id, input.chunkIds),
            ),
          );
      },
    ),
    calculator: defineTool(
      "Calculate with bounded numeric inputs",
      calculatorInput,
      calculate,
    ),
    compareSources: defineTool(
      "Compare selected evidence side by side",
      z.object({
        sources: z
          .array(
            z.object({
              title: z.string().max(180),
              excerpt: z.string().max(2000),
            }),
          )
          .min(2)
          .max(8),
      }),
      (input) => {
        const terms = input.sources.map((s) => new Set(queryTerms(s.excerpt)));
        const common = [...terms[0]].filter((t) =>
          terms.every((set) => set.has(t)),
        );
        return {
          commonTerms: common,
          rows: input.sources.map((source, i) => ({
            title: source.title,
            measurements: [
              ...source.excerpt.matchAll(
                /(?:\$)?\d[\d,.]*(?:x|%|\s+(?:weeks|engineers|requests|seconds))?/g,
              ),
            ]
              .map((m) => m[0])
              .slice(0, 12),
            distinctTerms: [...terms[i]]
              .filter((t) => !common.includes(t))
              .slice(0, 6),
          })),
        };
      },
    ),
    getCurrentDateTime: defineTool(
      "Read the current UTC time",
      z.object({}),
      () => ({ iso: new Date().toISOString(), timezone: "UTC" }),
    ),
    createNote: defineTool(
      "Save an explicitly requested research note",
      z.object({
        title: z.string().min(1).max(180),
        content: z.string().min(10).max(150000),
      }),
      (input) => ingest(workspaceId, input.title, input.content, "note"),
    ),
  };
}
export async function withTimeout<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  parent: AbortSignal,
  ms = 8000,
): Promise<T> {
  const signal = AbortSignal.any([parent, AbortSignal.timeout(ms)]);
  signal.throwIfAborted();
  return new Promise<T>((resolve, reject) => {
    const abort = () =>
      reject(
        new Error(parent.aborted ? "Execution cancelled." : "Tool timed out."),
      );
    signal.addEventListener("abort", abort, { once: true });
    operation(signal)
      .then(resolve, reject)
      .finally(() => signal.removeEventListener("abort", abort));
  });
}
