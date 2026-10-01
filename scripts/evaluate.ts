import assert from "node:assert/strict";
import {
  chunkText,
  buildContext,
  validateCitations,
} from "../src/server/retrieval/context";
import { seedDocuments, examplePrompt } from "../src/server/seed-content";
import { demoPlan, demoAnswer } from "../src/server/ai/provider";
import { calculate } from "../src/server/tools/registry";
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
const scenarios: [string, () => void][] = [
  [
    "Citations point to selected evidence",
    () => {
      assert.ok(
        validateCitations(
          demoAnswer({
            prompt: examplePrompt,
            citations: context.citations,
            toolResults: [],
          }),
          context.citations,
        ).length >= 4,
      );
    },
  ],
  [
    "Calculator is selected for explicit arithmetic",
    () => {
      const plan = demoPlan("Compute 40 * 10");
      assert.ok(plan.calculator);
      assert.equal(calculate(plan.calculator).value, 400);
    },
  ],
  [
    "Source diversity survives the context budget",
    () => {
      assert.equal(new Set(context.chunks.map((c) => c.documentId)).size, 4);
      assert.ok(context.tokens <= 2400);
    },
  ],
  [
    "Comparison identifies an unproven scaling assumption",
    () => {
      assert.match(
        demoAnswer({
          prompt: examplePrompt,
          citations: context.citations,
          toolResults: [],
        }),
        /Neither proposal has demonstrated/,
      );
      assert.equal(demoPlan(examplePrompt).compare, true);
    },
  ],
  [
    "Invalid arithmetic fails safely",
    () => {
      assert.throws(
        () => calculate({ a: 1, b: 0, operation: "divide" }),
        /zero/,
      );
    },
  ],
  [
    "Absent evidence produces an abstention",
    () => {
      assert.match(
        demoAnswer({ prompt: "unknown", citations: [], toolResults: [] }),
        /No matching evidence/,
      );
    },
  ],
  [
    "Unregistered citations fail validation",
    () => {
      assert.throws(() =>
        validateCitations("Unsupported [77]", context.citations),
      );
    },
  ],
];
let failed = 0;
for (const [name, evaluate] of scenarios) {
  try {
    evaluate();
    console.log(`PASS  ${name}`);
  } catch (error) {
    failed++;
    console.error(`FAIL  ${name}`, error);
  }
}
console.log(
  `\n${scenarios.length - failed}/${scenarios.length} deterministic evaluations passed. No claims about model quality.`,
);
process.exitCode = failed ? 1 : 0;
