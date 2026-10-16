import { ESLint } from "eslint";
import nextBase from "eslint-config-next";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { beforeAll, describe, expect, it } from "vitest";

type Diagnostic = { ruleId: string | null; severity: number; message: string };
type CompatibilityCase = {
  name: string;
  extension: "ts" | "tsx" | "js" | "jsx";
  source: string;
  engine?: "babel";
  messages: Diagnostic[];
};

// Expected diagnostics were recorded with ESLint 9.39.5 and Next 16.4.0.
// Virtual paths exercise the installed production configuration without creating
// source fixtures or executing the snippets.
const cases: CompatibilityCase[] = [
  {
    name: "accepts valid ARIA attributes and an accessible image",
    extension: "tsx",
    source: `export default function Probe() { return <div role="checkbox" aria-checked="true"><svg role="img" aria-label="Logo" /></div>; }`,
    messages: [],
  },
  {
    name: "accepts a Next image with alternative text",
    extension: "tsx",
    source: `import Image from "next/image"; export default function Probe() { return <Image src="/logo.png" width={20} height={20} alt="Workbench logo" />; }`,
    messages: [],
  },
  {
    name: "retains the missing image alternative warning",
    extension: "tsx",
    source: `import Image from "next/image"; export default function Probe() { return <Image src="/logo.png" width={20} height={20} />; }`,
    messages: [
      {
        ruleId: "jsx-a11y/alt-text",
        severity: 1,
        message:
          "Image elements must have an alt prop, either with meaningful text, or an empty string for decorative images.",
      },
    ],
  },
  {
    name: "retains the invalid ARIA attribute warning",
    extension: "tsx",
    source: `export default function Probe() { return <button aria-labl="Save">Save</button>; }`,
    messages: [
      {
        ruleId: "jsx-a11y/aria-props",
        severity: 1,
        message:
          "aria-labl: This attribute is an invalid ARIA attribute. Did you mean to use aria-label?",
      },
    ],
  },
  {
    name: "retains the missing required ARIA property warning",
    extension: "tsx",
    source: `export default function Probe() { return <div role="checkbox">Ready</div>; }`,
    messages: [
      {
        ruleId: "jsx-a11y/role-has-required-aria-props",
        severity: 1,
        message:
          'Elements with the ARIA role "checkbox" must have the following attributes defined: aria-checked',
      },
    ],
  },
  {
    name: "retains the anonymous default export warning",
    extension: "ts",
    source: `export default {};`,
    messages: [
      {
        ruleId: "import/no-anonymous-default-export",
        severity: 1,
        message:
          "Assign object to a variable before exporting as module default",
      },
    ],
  },
  {
    name: "accepts a named default export",
    extension: "ts",
    source: `const options = { mode: "demo" }; export default options;`,
    messages: [],
  },
  {
    name: "retains the undefined JSX component error",
    extension: "tsx",
    source: `export default function Probe() { return <Missing />; }`,
    messages: [
      {
        ruleId: "react/jsx-no-undef",
        severity: 2,
        message: "'Missing' is not defined.",
      },
    ],
  },
  {
    name: "accepts an imported component referenced only by JSX",
    extension: "tsx",
    source: `import Link from "next/link"; export default function Probe() { return <Link href="/">Home</Link>; }`,
    messages: [],
  },
  {
    name: "resolves configured and inline globals through the Next Babel parser",
    extension: "jsx",
    engine: "babel",
    source: `/* global __inline_eslint_global__: readonly */
import Link from "next/link"; export default function Probe() { return <Link href="/">{[window.location.href, process.cwd(), __configured_eslint_global__, __inline_eslint_global__].join(" ")}</Link>; }`,
    messages: [],
  },
  {
    name: "reports unknown globals through the Next Babel parser",
    extension: "js",
    engine: "babel",
    source: `export const value = __missing_eslint_global__;`,
    messages: [
      {
        ruleId: "no-undef",
        severity: 2,
        message: "'__missing_eslint_global__' is not defined.",
      },
    ],
  },
  {
    name: "reports an undefined JSX component through the Next Babel parser",
    extension: "jsx",
    engine: "babel",
    source: `export default function Probe() { return <Missing />; }`,
    messages: [
      {
        ruleId: "react/jsx-no-undef",
        severity: 2,
        message: "'Missing' is not defined.",
      },
    ],
  },
  {
    name: "reports unused variables through the Next Babel parser",
    extension: "js",
    engine: "babel",
    source: `const unused = 1; export const answer = 42;`,
    messages: [
      {
        ruleId: "no-unused-vars",
        severity: 2,
        message: "'unused' is assigned a value but never used.",
      },
    ],
  },
];

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const nested = resolve(root, "src", "app");
const require = createRequire(import.meta.url);
const cli = resolve(
  dirname(require.resolve("eslint/package.json")),
  "bin/eslint.js",
);
const reports = new Map<string, ESLint.LintResult>();
const project = new ESLint({ cwd: root });

function diagnostics(report: ESLint.LintResult): Diagnostic[] {
  return report.messages.map(({ ruleId, severity, message }) => ({
    ruleId,
    severity,
    message,
  }));
}

beforeAll(async () => {
  // Production also extends the TypeScript preset. The isolated base preset
  // deliberately exercises Next's Babel adapter, which ESLint 10 requires for
  // scope globals and the legacy React/import context methods. The two core
  // probe rules have failing controls; no production rule is disabled.
  const babel = new ESLint({
    cwd: root,
    overrideConfigFile: true,
    overrideConfig: [
      ...nextBase,
      {
        rules: { "no-undef": "error", "no-unused-vars": "error" },
        languageOptions: {
          globals: { __configured_eslint_global__: "readonly" },
        },
      },
    ],
  });
  for (const test of cases) {
    const [report] = await (test.engine === "babel" ? babel : project).lintText(
      test.source,
      {
        filePath: resolve(
          root,
          "src",
          `__eslint10_compatibility__.${test.extension}`,
        ),
      },
    );
    reports.set(test.name, report);
  }
}, 30_000);

describe("ESLint major-version compatibility", () => {
  it.each(cases)("$name", (test) => {
    const report = reports.get(test.name)!;
    expect(report.fatalErrorCount).toBe(0);
    expect(diagnostics(report)).toEqual(test.messages);
    expect(report.errorCount).toBe(
      test.messages.filter(({ severity }) => severity === 2).length,
    );
    expect(report.warningCount).toBe(
      test.messages.filter(({ severity }) => severity === 1).length,
    );
  });

  it("keeps production rule severities when config is discovered from a subdirectory", async () => {
    const path = resolve(root, "src", "__eslint10_compatibility__.tsx");
    const original = await project.calculateConfigForFile(path);
    const discovered = await new ESLint({ cwd: nested }).calculateConfigForFile(
      path,
    );
    expect(original).toBeDefined();
    expect(discovered.rules).toEqual(original.rules);
    expect(discovered.settings).toEqual(original.settings);
    expect(discovered.languageOptions.globals).toEqual(
      original.languageOptions.globals,
    );
    expect(discovered.languageOptions.parser.meta.name).toBe(
      "typescript-eslint/parser",
    );
    expect(original.rules).toMatchObject({
      "jsx-a11y/alt-text": [1, { elements: ["img"], img: ["Image"] }],
      "jsx-a11y/aria-props": [1],
      "jsx-a11y/role-has-required-aria-props": [1],
      "import/no-anonymous-default-export": [1],
      "react/jsx-no-undef": [2],
      "react/jsx-uses-vars": [2],
      "react-hooks/rules-of-hooks": [2],
      "@next/next/no-html-link-for-pages": [2],
      "@typescript-eslint/no-explicit-any": [2],
      "@typescript-eslint/no-unused-vars": [1],
    });
  });

  it.each([
    [".next/generated.js", true],
    ["out/generated.js", true],
    ["build/generated.js", true],
    ["next-env.d.ts", true],
    ["playwright-report/generated.js", true],
    ["test-results/generated.js", true],
    ["src/app/page.tsx", false],
    ["tests/next-eslint-config.test.ts", false],
    ["eslint.config.mjs", false],
  ] as const)("preserves the ignore decision for %s", async (path, ignored) => {
    const absolute = resolve(root, path);
    expect(await project.isPathIgnored(absolute)).toBe(ignored);
    expect(await new ESLint({ cwd: nested }).isPathIgnored(absolute)).toBe(
      ignored,
    );
  });

  it.each([
    ["repository root", root],
    ["application subdirectory", nested],
  ])(
    "discovers the production config through the CLI from %s",
    (_name, cwd) => {
      const test = cases.find(
        ({ name }) => name === "retains the invalid ARIA attribute warning",
      )!;
      const result = spawnSync(
        process.execPath,
        [
          cli,
          "--stdin",
          "--stdin-filename",
          resolve(root, "src", "__eslint10_cli_compatibility__.tsx"),
          "--format",
          "json",
        ],
        { cwd, input: test.source, encoding: "utf8", timeout: 30_000 },
      );
      expect(result.error).toBeUndefined();
      expect(result.status, result.stderr).toBe(0);
      const [report] = JSON.parse(result.stdout) as ESLint.LintResult[];
      expect(report.fatalErrorCount).toBe(0);
      expect(diagnostics(report)).toEqual(test.messages);
    },
    35_000,
  );
});
