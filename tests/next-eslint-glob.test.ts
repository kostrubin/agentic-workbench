import { execFileSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

type RootCase = {
  name: string;
  rootDir?: string | string[];
  expected: string[];
  unordered?: boolean;
};
type Diagnostic = { ruleId: string | null; message: string; severity: number };
type LintReport = { errorCount: number; messages: Diagnostic[] };

// Expectations were recorded against Next 16.3.8's original fast-glob helper.
// Exercise the installed plugin, so a missing patch or a disabled rule fails.
const require = createRequire(import.meta.url);
const configRequire = createRequire(require.resolve("eslint-config-next"));
const pluginPath = configRequire.resolve("@next/eslint-plugin-next");
const eslintPath = require.resolve("eslint");
const rootHelperPath = join(dirname(pluginPath), "utils/get-root-dirs.js");
const pluginRequire = createRequire(pluginPath);
const globRequire = createRequire(pluginRequire.resolve("tinyglobby"));
const crawlerPath = globRequire.resolve("fdir");
const crawlerEsmPath = join(dirname(crawlerPath), "index.mjs");

// Isolate process.cwd(): Next resolves explicit relative rootDir patterns from
// the process directory, whereas its no-rootDir default uses context.cwd.
const probe = String.raw`
const fs = require("node:fs");
const { ESLint } = require(process.argv[1]);
const pluginModule = require(process.argv[2]);
const plugin = pluginModule.default ?? pluginModule;
const { getRootDirs } = require(process.argv[3]);
const { pathToFileURL } = require("node:url");
const input = JSON.parse(fs.readFileSync(0, "utf8"));
(async () => {
  const roots = {};
  for (const test of input.roots) {
    roots[test.name] = getRootDirs({
      cwd: input.contextCwd,
      settings: test.rootDir === undefined ? {} : { next: { rootDir: test.rootDir } },
    });
  }
  const lint = {};
  for (const test of input.lint) {
    const eslint = new ESLint({
      cwd: process.cwd(),
      overrideConfigFile: true,
      overrideConfig: [{
        files: ["**/*.jsx"],
        languageOptions: { parserOptions: { ecmaFeatures: { jsx: true } } },
        plugins: { "@next/next": plugin },
        settings: test.rootDir === undefined ? {} : { next: { rootDir: test.rootDir } },
        rules: { "@next/next/no-html-link-for-pages": "error" },
      }],
    });
    const [report] = await eslint.lintText(test.source, { filePath: "component.jsx" });
    lint[test.name] = {
      errorCount: report.errorCount,
      messages: report.messages.map(({ ruleId, message, severity }) => ({ ruleId, message, severity })),
    };
  }
  const guards = {};
  for (const test of input.guards) {
    try {
      getRootDirs({ cwd: process.cwd(), settings: { next: { rootDir: test.pattern } } });
      guards[test.name] = { name: "NoError", message: "Pattern was accepted" };
    } catch (error) {
      guards[test.name] = { name: error.name, message: error.message };
    }
  }
  const crawlers = {};
  for (const [name, module] of [
    ["CJS", require(process.argv[4])],
    ["ESM", await import(pathToFileURL(process.argv[5]).href)],
  ]) {
    const paths = new module.fdir().onlyDirs().withSymlinks({ resolvePaths: false }).crawl(input.cycleRoot).sync();
    crawlers[name] = paths;
  }
  process.stdout.write(JSON.stringify({ roots, lint, guards, crawlers }));
})().catch((error) => { console.error(error); process.exitCode = 1; });
`;

let fixture: string;
let rootCases: RootCase[];
let reports: {
  roots: Record<string, string[]>;
  lint: Record<string, LintReport>;
  guards: Record<string, { name: string; message: string }>;
  crawlers: Record<string, string[]>;
};

beforeAll(() => {
  fixture = mkdtempSync(join(tmpdir(), "workbench-next-eslint-"));
  for (const directory of [
    "packages/web",
    "packages/admin",
    "packages/.hidden",
    ".private/web",
    "range1",
    "range2",
    "range3",
    "range4",
    "range5",
    "range01",
    "range02",
    "range03",
    "nested/x1",
    "nested/x2",
    "nested/x3",
    "nested/ya",
    "nested/yb",
  ]) {
    mkdirSync(join(fixture, directory), { recursive: true });
  }
  for (const value of [
    "-4",
    "-2",
    "0",
    ...Array.from({ length: 12 }, (_, i) => String(i + 1)),
    "01",
    "02",
    "03",
    "04",
    "05",
    "a",
    "b",
    "c",
    "d",
    "e",
  ])
    mkdirSync(join(fixture, "numbers", value), { recursive: true });
  writeFileSync(join(fixture, "packages/file"), "This is a file, not a root.");
  symlinkSync(
    join(fixture, "packages/web"),
    join(fixture, "linked-web"),
    "dir",
  );
  symlinkSync(
    join(fixture, "packages/web"),
    join(fixture, "packages/linked"),
    "dir",
  );
  for (const directory of ["", "packages/web", "packages/admin"]) {
    const app = join(fixture, directory, "src/app");
    mkdirSync(app, { recursive: true });
    writeFileSync(
      join(app, "page.tsx"),
      "export default function Page() { return null; }",
    );
  }
  for (const [root, route] of [
    ["range1", "one"],
    ["range2", "two"],
    ["range3", "three"],
    ["range5", "five"],
    ["numbers/a", "alpha"],
  ]) {
    const pages = join(fixture, root, "src/pages");
    mkdirSync(pages, { recursive: true });
    writeFileSync(
      join(pages, `${route}.tsx`),
      "export default function Page() { return null; }",
    );
  }
  const cycleRoot = join(fixture, "symlink-safety");
  mkdirSync(join(cycleRoot, "target/child"), { recursive: true });
  symlinkSync("target", join(cycleRoot, "linked"), "dir");
  symlinkSync("../", join(cycleRoot, "target/back"), "dir");
  symlinkSync("missing", join(cycleRoot, "dangling"), "dir");

  const visiblePackages = ["packages/admin", "packages/linked", "packages/web"];
  rootCases = [
    { name: "context cwd default", expected: [join(fixture, "other-context")] },
    {
      name: "literal directory",
      rootDir: "packages/web",
      expected: ["packages/web"],
    },
    { name: "literal file excluded", rootDir: "packages/file", expected: [] },
    {
      name: "wildcard directories",
      rootDir: "packages/*",
      expected: visiblePackages,
      unordered: true,
    },
    {
      name: "array roots preserve order",
      rootDir: ["packages/web", "packages/admin"],
      expected: ["packages/web", "packages/admin"],
    },
    // The helper runs each array item independently; a separate negative item
    // does not subtract paths selected by a previous positive item.
    {
      name: "independent array negation",
      rootDir: ["packages/*", "!packages/admin"],
      expected: visiblePackages,
      unordered: true,
    },
    { name: "standalone negation", rootDir: "!packages/admin", expected: [] },
    {
      name: "choice plus separate negation",
      rootDir: ["packages/{web,admin}", "!packages/admin"],
      expected: ["packages/web", "packages/admin"],
    },
    {
      name: "Windows separators",
      rootDir: "packages\\web",
      expected: ["packages/web"],
    },
    {
      name: "literal dot directory",
      rootDir: "packages/.hidden",
      expected: ["packages/.hidden"],
    },
    {
      name: "explicit dot wildcard",
      rootDir: "packages/.*",
      expected: ["packages/.hidden"],
    },
    {
      name: "globstar excludes dot directories",
      rootDir: "**/web",
      expected: ["packages/web"],
    },
    {
      name: "relative dot prefix",
      rootDir: "./packages/web",
      expected: ["./packages/web"],
    },
    {
      name: "absolute directory",
      rootDir: join(fixture, "packages/web"),
      expected: [join(fixture, "packages/web")],
    },
    {
      name: "absolute wildcard",
      rootDir: join(fixture, "packages/*"),
      expected: visiblePackages.map((directory) => join(fixture, directory)),
      unordered: true,
    },
    {
      name: "literal directory symlink",
      rootDir: "linked-web",
      expected: ["linked-web"],
    },
    {
      name: "wildcard directory symlink",
      rootDir: "packages/link*",
      expected: ["packages/linked"],
    },
    {
      name: "numeric range",
      rootDir: "range{1..3}",
      expected: ["range1", "range2", "range3"],
    },
    {
      name: "stepped numeric range",
      rootDir: "range{1..5..2}",
      expected: ["range1", "range3", "range5"],
    },
    {
      name: "padded numeric range",
      rootDir: "range{01..03}",
      expected: ["range01", "range02", "range03"],
    },
    {
      name: "brace choice order",
      rootDir: "packages/{web,admin}",
      expected: ["packages/web", "packages/admin"],
    },
    {
      name: "terminal globstar excludes its base",
      rootDir: "packages/web/**",
      expected: ["packages/web/src", "packages/web/src/app"],
      unordered: true,
    },
    {
      name: "symlink terminal globstar",
      rootDir: "linked-web/**",
      expected: ["linked-web/src", "linked-web/src/app"],
      unordered: true,
    },
    {
      name: "signed range length order",
      rootDir: "numbers/{-4..4..2}",
      expected: [
        "numbers/0",
        "numbers/2",
        "numbers/4",
        "numbers/-4",
        "numbers/-2",
      ],
    },
    {
      name: "descending stepped range",
      rootDir: "numbers/{5..1..2}",
      expected: ["numbers/5", "numbers/3", "numbers/1"],
    },
    {
      name: "letter range",
      rootDir: "numbers/{a..e}",
      expected: [
        "numbers/a",
        "numbers/b",
        "numbers/c",
        "numbers/d",
        "numbers/e",
      ],
    },
    {
      name: "stepped letter range",
      rootDir: "numbers/{a..e..2}",
      expected: ["numbers/a", "numbers/c", "numbers/e"],
    },
    {
      name: "multidigit numeric range",
      rootDir: "numbers/{1..12}",
      expected: Array.from({ length: 12 }, (_, i) => `numbers/${i + 1}`),
    },
    {
      name: "padded stepped range",
      rootDir: "numbers/{01..05..2}",
      expected: ["numbers/01", "numbers/03", "numbers/05"],
    },
    {
      name: "nested ranges and choices",
      rootDir: "nested/{x{1..3},y{a,b}}",
      expected: [
        "nested/x1",
        "nested/x2",
        "nested/x3",
        "nested/ya",
        "nested/yb",
      ],
    },
    {
      name: "brace choices with character classes",
      rootDir: "packages/{[wa]*,link*}",
      expected: visiblePackages,
      unordered: true,
    },
    {
      name: "comma inside character class",
      rootDir: "numbers/{[a,b],c}",
      expected: ["numbers/c", "numbers/a", "numbers/b"],
    },
    {
      name: "nested choice with comma class",
      rootDir: "numbers/{[a,b],{c,d}}",
      expected: ["numbers/c", "numbers/d", "numbers/a", "numbers/b"],
    },
    {
      name: "quoted letter range",
      rootDir: 'numbers/{"a".."c"}',
      expected: ["numbers/a", "numbers/b", "numbers/c"],
    },
  ];
  const anchor = 'export const Menu = () => <a href="/">Home</a>;';
  const lint = [
    { name: "default anchor", source: anchor },
    { name: "literal anchor", rootDir: "packages/web", source: anchor },
    { name: "wildcard anchor", rootDir: "packages/*", source: anchor },
    {
      name: "array anchor",
      rootDir: ["packages/web", "packages/admin"],
      source: anchor,
    },
    {
      name: "valid Link",
      rootDir: "packages/web",
      source:
        'import Link from "next/link"; export const Menu = () => <Link href="/">Home</Link>;',
    },
    {
      name: "external anchor",
      rootDir: "packages/web",
      source:
        'export const Menu = () => <a href="https://example.com/">Home</a>;',
    },
    { name: "symlink anchor", rootDir: "linked-web", source: anchor },
    {
      name: "stepped included route",
      rootDir: "range{1..5..2}",
      source: 'export const Menu = () => <a href="/one">One</a>;',
    },
    {
      name: "stepped excluded route",
      rootDir: "range{1..5..2}",
      source: 'export const Menu = () => <a href="/two">Two</a>;',
    },
    {
      name: "character class route",
      rootDir: "numbers/{[a,b],c}",
      source: 'export const Menu = () => <a href="/alpha">Alpha</a>;',
    },
  ];
  const guards = [
    { name: "excessive nesting", pattern: "{".repeat(129) + "}".repeat(129) },
    { name: "excessive range", pattern: "range{1..1001}" },
    { name: "excessive combinations", pattern: "range" + "{a,b}".repeat(11) },
  ];
  const stdout = execFileSync(
    process.execPath,
    [
      "-e",
      probe,
      eslintPath,
      pluginPath,
      rootHelperPath,
      crawlerPath,
      crawlerEsmPath,
    ],
    {
      cwd: fixture,
      input: JSON.stringify({
        roots: rootCases,
        contextCwd: join(fixture, "other-context"),
        lint,
        guards,
        cycleRoot,
      }),
      encoding: "utf8",
      timeout: 10000,
    },
  );
  reports = JSON.parse(stdout) as typeof reports;
}, 15000);

afterAll(() => {
  if (fixture) rmSync(fixture, { recursive: true, force: true });
});

describe("installed Next ESLint root discovery", () => {
  // Keep test registration independent of beforeAll's dynamically built paths.
  const names = [
    "context cwd default",
    "literal directory",
    "literal file excluded",
    "wildcard directories",
    "array roots preserve order",
    "independent array negation",
    "standalone negation",
    "choice plus separate negation",
    "Windows separators",
    "literal dot directory",
    "explicit dot wildcard",
    "globstar excludes dot directories",
    "relative dot prefix",
    "absolute directory",
    "absolute wildcard",
    "literal directory symlink",
    "wildcard directory symlink",
    "numeric range",
    "stepped numeric range",
    "padded numeric range",
    "brace choice order",
    "terminal globstar excludes its base",
    "symlink terminal globstar",
    "signed range length order",
    "descending stepped range",
    "letter range",
    "stepped letter range",
    "multidigit numeric range",
    "padded stepped range",
    "nested ranges and choices",
    "brace choices with character classes",
    "comma inside character class",
    "nested choice with comma class",
    "quoted letter range",
  ];
  it.each(names)("preserves %s", (name) => {
    const test = rootCases.find((test) => test.name === name)!;
    const actual = reports.roots[name];
    expect(test.unordered ? [...actual].sort() : actual).toEqual(
      test.unordered ? [...test.expected].sort() : test.expected,
    );
  });
});

describe("installed Next internal-link diagnostics", () => {
  it.each([
    "default anchor",
    "literal anchor",
    "wildcard anchor",
    "array anchor",
    "symlink anchor",
  ])("rejects %s with the original diagnostic", (name) => {
    expect(reports.lint[name]).toEqual({
      errorCount: 1,
      messages: [
        {
          ruleId: "@next/next/no-html-link-for-pages",
          severity: 2,
          message:
            "Do not use an `<a>` element to navigate to `/`. Use `<Link />` from `next/link` instead. See: https://nextjs.org/docs/messages/no-html-link-for-pages",
        },
      ],
    });
  });
  it("checks only routes selected by the stepped range", () => {
    expect(reports.lint["stepped included route"]).toEqual({
      errorCount: 1,
      messages: [
        {
          ruleId: "@next/next/no-html-link-for-pages",
          severity: 2,
          message:
            "Do not use an `<a>` element to navigate to `/one/`. Use `<Link />` from `next/link` instead. See: https://nextjs.org/docs/messages/no-html-link-for-pages",
        },
      ],
    });
  });
  it("keeps routes matched by a comma-containing character class", () => {
    expect(reports.lint["character class route"]).toEqual({
      errorCount: 1,
      messages: [
        {
          ruleId: "@next/next/no-html-link-for-pages",
          severity: 2,
          message:
            "Do not use an `<a>` element to navigate to `/alpha/`. Use `<Link />` from `next/link` instead. See: https://nextjs.org/docs/messages/no-html-link-for-pages",
        },
      ],
    });
  });
  it.each(["valid Link", "external anchor", "stepped excluded route"])(
    "accepts %s",
    (name) => {
      expect(reports.lint[name]).toEqual({ errorCount: 0, messages: [] });
    },
  );
});

describe("bounded Next root patterns", () => {
  it.each(["excessive nesting", "excessive range", "excessive combinations"])(
    "rejects %s before traversal",
    (name) => {
      expect(reports.guards[name].name).toBe("RangeError");
      expect(reports.guards[name].message).toMatch(/Next rootDir/);
    },
  );
});

describe("shared directory-symlink fix", () => {
  it.each(["CJS", "ESM"])(
    "handles directory, dangling and cyclic symlinks in %s",
    (name) => {
      const paths = reports.crawlers[name];
      expect(paths.some((path) => /\/linked\/?$/.test(path))).toBe(true);
      expect(paths.some((path) => path.includes("/dangling"))).toBe(false);
      // An unbounded cycle would exceed the probe's timeout, rather than finish
      // with this small fixture's finite directory set.
      expect(paths.length).toBeLessThan(20);
    },
  );
  it("keeps CJS and ESM behavior identical", () => {
    expect([...reports.crawlers.CJS].sort()).toEqual(
      [...reports.crawlers.ESM].sort(),
    );
  });
});
