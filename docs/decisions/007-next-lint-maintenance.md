# Maintain the patched Next lint stack through reviewed upgrades

## Decision

Upgrade `next` and `eslint-config-next` together from 16.3.8 to exact 16.4.0 pins. Retarget the `@next/eslint-plugin-next` patch, override, and package extension to 16.4.0. Keep `tinyglobby` 0.2.17, `fill-range` 7.1.1, the `fdir` 6.5.0 patch, and the original lint compatibility expectations from [the glob migration](006-next-lint-glob-migration.md). Keep React, TypeScript, ESLint, pnpm, and all unrelated direct dependency specifications unchanged.

While this exact-version patch is maintained, ordinary Dependabot version updates for `next` and `eslint-config-next` are manual. A maintainer prepares their coordinated upgrade in a separate PR and reviews the upstream packages and patches before merging. Other npm and GitHub Actions updates retain their existing automation; the existing TypeScript and ESLint major-version boundaries remain in place.

## Reason

Dependabot's attempt to update `eslint-config-next` to 16.4.0 left a patch scoped to plugin 16.3.8. pnpm correctly rejected the resulting installation with `ERR_PNPM_UNUSED_PATCH`. Ignoring this error would permit upgrades to silently stop applying the dependency mitigation.

The published 16.4.0 plugin distribution matches 16.3.8 apart from its package version, so the helper adaptation can be retargeted without changing its implementation. The upstream dependency on `fast-glob` remains, so removing the adapter would restore the `fast-glob` → `micromatch` → `braces` chain. `eslint-config-next` itself changed its configuration and import-resolver integration, including ESLint 10 compatibility work; ESLint 9 remains declared compatible. An unchanged plugin therefore does not make the wider lint upgrade automatically compatible.

The registry marks the retained ESLint 9.39.5 release as deprecated. This PR isolates the Next.js/lint upgrade and verifies compatibility with the existing ESLint version; an ESLint major-version migration remains a separate maintenance task.

## Dependabot boundary

The two dependency-specific `ignore` entries list only these explicit `update-types`:

- `version-update:semver-major`
- `version-update:semver-minor`
- `version-update:semver-patch`

They contain no `versions` field and are not bare dependency ignores. This suppresses ordinary version-update attempts for the maintained pair while retaining Dependabot security update attempts and alerts. A security update can still fail if it needs a patch port; the maintainer must investigate that failure and prepare a reviewed update. This policy does not promise that every security update can be applied automatically, and it does not add advisory suppression.

The policy takes effect for Dependabot after this configuration reaches the default branch. A PR's CI validates installation and application behavior, but does not prove that a future scheduled Dependabot job will succeed. Check the next job separately after an approved merge.

References: [Dependabot ignore options](https://docs.github.com/en/code-security/dependabot/working-with-dependabot/dependabot-options-reference#ignore) and [the version-ignore implementation](https://github.com/dependabot/dependabot-core/blob/main/common/lib/dependabot/config/ignore_condition.rb).

## Upgrade and verification procedure

1. Start a separate branch from current `main`. Compare published plugin files and lint configuration with the installed versions; review release notes and peer requirements. Keep unrelated dependency updates out of the PR.
2. Upgrade the Next.js/lint pair together. Retarget every exact plugin reference and rename the patch file; preserve the adapter's behavior unless a separately reviewed compatibility change is necessary. Keep pnpm's unused-patch validation enabled.
3. Update the lockfile only as required by the pair and its transitive dependencies. Verify that unrelated direct dependency specifications and unrelated retained locked package versions have not drifted.
4. Install from the frozen lockfile and verify that both patches apply. Run the original 50 lint regressions without changing their recorded expectations, and add configuration-level checks for TypeScript/TSX parsing, React rules, imports, and TypeScript path aliases.
5. Run formatting, lint, typecheck, all unit/component tests, evaluations, database/provider/MCP integration tests, production build, and desktop/mobile E2E. The pre-upgrade baseline is 72 unit/component tests, 10 integration tests, 10 browser tests, and 7 evaluation scenarios; new lint cases extend that baseline.
6. Run complete and production dependency audits, verify that `fast-glob`, `micromatch`, and `braces` are absent from the lockfile and installed dependency graph, and scan Git history for secrets. A clean audit describes known advisories at the time of the check.
7. Open the PR, wait for full CI on its exact head commit, and report the results and patch maintenance limits. Merge only with the owner's approval. After an approved merge, verify CI and the subsequent Dependabot job independently.

Validation results belong to the PR and its CI runs; this decision defines required checks rather than asserting that a future run has passed.

## Removal criteria

When an upstream release removes the vulnerable chain and preserves the directory-selection and lint behavior covered by the compatibility suite, remove the version-specific plugin patch, package extension, and override together. Reassess the shared Fdir patch independently before removing it. Restore ordinary Dependabot updates for the pair when upgrades no longer require a local patch port, then rerun the full suite and dependency checks.
