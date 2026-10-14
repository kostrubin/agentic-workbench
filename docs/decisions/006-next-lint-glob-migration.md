# Next lint directory discovery with tinyglobby

## Decision

Keep the existing Next.js, React, TypeScript, ESLint, and pnpm versions. Replace the development-only Next ESLint plugin's `fast-glob` dependency with pinned `tinyglobby` 0.2.17 through pnpm package extensions and an exact-version override. Apply reproducible patches to `@next/eslint-plugin-next` 16.3.8 and `fdir` 6.5.0. Application code and lint rule severity remain unchanged.

## Reason

The previous chain included `braces` 3.0.3 and GHSA-vfj7-8cjw-p6xm. There is no published fixed braces release as of October 14, 2026. Ordinary Next lint updates retain that dependency. The current application does not set `settings.next.rootDir`, so its normal lint run did not invoke the glob branch; the dependency was still present in the development graph.

The direction follows [Next's unmerged migration proposal](https://github.com/vercel/next.js/pull/89531). This repository maintains its own tested adaptation rather than relying on an unreviewed PR or a blind package alias.

## Compatibility boundary

The original helper's default still uses `context.cwd`; explicit relative root patterns still use `process.cwd`. Array entries remain independent, including negative entries. Directory expansion is disabled. Absolute paths, literal dot prefixes, source-root selection, and internal-link diagnostics are covered by regressions recorded against the original installed plugin.

`tinyglobby` does not preserve all legacy brace ranges. The patched helper expands ordinary comma choices and numeric/alphabetic ranges with `fill-range` 7.1.1, retained from the previous graph. Expansion is iterative and bounded: 10,000 input characters, 128 nested brace levels, 1,000 values per range, 1,000 expanded patterns, and 1,000,000 generated characters. Excessive configuration raises a validation error. This intentionally does not promise compatibility for pathological or every possible Bash-style expression.

Fdir's original directory-symlink callback traversed a link without returning the link itself. A one-statement patch in both distribution formats includes that directory while preserving the existing exclusion and recursion checks. It is shared by other development consumers of this exact Fdir version, including TypeScript lint tooling and Vitest; the full project suite checks those consumers too.

## Maintenance and verification

The manifest and resolved main-stack versions must remain identical to the base commit. Frozen-lockfile installation must apply both patches. Regression tests load the actual installed Next plugin and check expected directory sets and lint messages; no vulnerable library is added just to serve as a test oracle.

Run formatting, lint, typecheck, unit/component tests, evaluations, database/provider/MCP integration tests, production build, and desktop/mobile E2E. Check the complete dependency audit and absence of `fast-glob`, `micromatch`, and `braces` in the lockfile. A clean audit is a current advisory result, not a universal security guarantee.

When a supported upstream release removes the chain and preserves the required behavior, remove the package extension, override, and patches together and rerun the compatibility suite. Exact-version patches deliberately require review when their packages change; do not disable unused-patch checks to make an upgrade pass.
