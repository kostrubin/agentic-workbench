import { ESLint } from "eslint";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

type Diagnostic = { ruleId: string | null; message: string; severity: number };
type CompatibilityCase = {
  name: string;
  extension: "ts" | "tsx" | "mjs";
  source: string;
  probe?: "imports" | "globals";
  messages: Diagnostic[];
};

// Recorded with the project's real flat config on Next 16.3.8, before upgrading.
// These lintText paths are virtual: no fixture or environment file is executed.
const cases: CompatibilityCase[] = [
  {
    name: "accepts typed TSX with React hooks and Next components",
    extension: "tsx",
    source: `import { useState } from "react";
import Link from "next/link";
import { examplePrompt } from "@/lib/demo";
export default function Probe() {
  const [count, setCount] = useState<number>(0);
  return <section><Link href="/">{examplePrompt}</Link><button onClick={() => setCount(count + 1)}>{count}</button></section>;
}`,
    messages: [],
  },
  {
    name: "accepts TypeScript syntax and DOM and Node type references",
    extension: "ts",
    source: `export interface Probe { request: Request; response: Response; }
export const options = { mode: "demo", retries: 3 } satisfies Record<string, string | number>;
export type Mode = typeof options.mode;
export const environment: string | undefined = process.env.NODE_ENV;`,
    messages: [],
  },
  {
    name: "rejects a conditional React hook as an error",
    extension: "tsx",
    source: `import { useState } from "react";
export default function Probe({enabled}: {enabled: boolean}) {
  if (enabled) { useState(0); }
  return <p>Ready</p>;
}`,
    messages: [
      {
        ruleId: "react-hooks/rules-of-hooks",
        severity: 2,
        message:
          'React Hook "useState" is called conditionally. React Hooks must be called in the exact same order in every component render.',
      },
    ],
  },
  {
    name: "rejects React list elements without keys",
    extension: "tsx",
    source: `export default function Probe() { return ["a", "b"].map((label) => <span>{label}</span>); }`,
    messages: [
      {
        ruleId: "react/jsx-key",
        severity: 2,
        message: 'Missing "key" prop for element in iterator',
      },
    ],
  },
  {
    name: "retains the TypeScript explicit-any error",
    extension: "ts",
    source: `export function identity(value: any) { return value; }`,
    messages: [
      {
        ruleId: "@typescript-eslint/no-explicit-any",
        severity: 2,
        message: "Unexpected any. Specify a different type.",
      },
    ],
  },
  {
    name: "retains the TypeScript unused-variable warning",
    extension: "ts",
    source: `export const answer = 42; const unused = 1;`,
    messages: [
      {
        ruleId: "@typescript-eslint/no-unused-vars",
        severity: 1,
        message: "'unused' is assigned a value but never used.",
      },
    ],
  },
  {
    name: "retains the Next document and title rule severities",
    extension: "tsx",
    source: `import { Head } from "next/document"; export default function Probe() { return <Head><title>Wrong</title></Head>; }`,
    messages: [
      {
        ruleId: "@next/next/no-document-import-in-page",
        severity: 2,
        message:
          "`<Document />` from `next/document` should not be imported outside of `pages/_document.js`. See: https://nextjs.org/docs/messages/no-document-import-in-page",
      },
      {
        ruleId: "@next/next/no-title-in-document-head",
        severity: 1,
        message:
          "Do not use `<title>` element with `<Head />` component from `next/document`. Titles should defined at the page-level using `<Head />` from `next/head` instead. See: https://nextjs.org/docs/messages/no-title-in-document-head",
      },
    ],
  },
  {
    name: "resolves installed pnpm packages, Next subpaths, and tsconfig aliases",
    extension: "tsx",
    probe: "imports",
    source: `import { z } from "zod";
import Link from "next/link";
import { examplePrompt } from "@/lib/demo";
export const imports = [z, Link, examplePrompt];`,
    messages: [],
  },
  {
    name: "reports a missing tsconfig alias target through the same resolver",
    extension: "tsx",
    probe: "imports",
    source: `import missing from "@/lib/__missing_eslint_compatibility__"; export default missing;`,
    messages: [
      {
        ruleId: "import/no-unresolved",
        severity: 2,
        message:
          "Unable to resolve path to module '@/lib/__missing_eslint_compatibility__'.",
      },
    ],
  },
  {
    name: "recognizes the flat config's browser and Node globals",
    extension: "mjs",
    probe: "globals",
    source: `export function globals() { return [window.location.href, document.title, process.cwd(), new Request("https://example.test"), new Response("ok"), Buffer.from("ok")]; }`,
    messages: [],
  },
  {
    name: "reports an unknown global through the same language configuration",
    extension: "mjs",
    probe: "globals",
    source: `export const value = __eslint_missing_global__;`,
    messages: [
      {
        ruleId: "no-undef",
        severity: 2,
        message: "'__eslint_missing_global__' is not defined.",
      },
    ],
  },
];

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const reports = new Map<string, ESLint.LintResult>();

beforeAll(async () => {
  const options = {
    cwd: root,
    overrideConfigFile: resolve(root, "eslint.config.mjs"),
  };
  const eslint = new ESLint(options);
  // The production preset does not enable these two probe rules. Enabling only
  // these probes exercises its actual resolver and globals, with failing controls;
  // no production rules, plugins, parsers, settings, or ignores are replaced.
  const imports = new ESLint({
    ...options,
    overrideConfig: [{ rules: { "import/no-unresolved": "error" } }],
  });
  const globals = new ESLint({
    ...options,
    overrideConfig: [{ rules: { "no-undef": "error" } }],
  });
  for (const test of cases) {
    const engine =
      test.probe === "imports"
        ? imports
        : test.probe === "globals"
          ? globals
          : eslint;
    const [report] = await engine.lintText(test.source, {
      filePath: resolve(
        root,
        "src",
        `__eslint_compatibility__.${test.extension}`,
      ),
    });
    reports.set(test.name, report);
  }
}, 30_000);

describe("Next ESLint flat-config compatibility", () => {
  it.each(cases)("$name", (test) => {
    const report = reports.get(test.name)!;
    expect(report.fatalErrorCount).toBe(0);
    expect(
      report.messages.map(({ ruleId, severity, message }) => ({
        ruleId,
        severity,
        message,
      })),
    ).toEqual(test.messages);
    expect(report.errorCount).toBe(
      test.messages.filter(({ severity }) => severity === 2).length,
    );
    expect(report.warningCount).toBe(
      test.messages.filter(({ severity }) => severity === 1).length,
    );
  });
});
