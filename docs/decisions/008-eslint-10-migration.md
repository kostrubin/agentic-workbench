# Migrate to ESLint 10 with scoped peer exceptions

## Decision

Upgrade ESLint from 9.39.5 to 10.12.0, with the direct dependency range allowing later 10.x releases. Keep Next.js and `eslint-config-next` at 16.4.0, retain the existing lint configuration and diagnostics, and preserve unrelated direct dependencies and locked versions. Preserve both existing patch files, their targets, and unused-patch validation from [the Next lint maintenance decision](007-next-lint-maintenance.md).

Enable pnpm's strict peer dependency validation. Allow ESLint `^10.12.0` only for these three exact plugin versions using parent-scoped `peerDependencyRules.allowedVersions` entries:

- `eslint-plugin-import@2.32.0>eslint`
- `eslint-plugin-react@7.37.5>eslint`
- `eslint-plugin-jsx-a11y@6.10.2>eslint`

The provider range permits ESLint 10.12.0 and later compatible 10.x updates, but excludes ESLint 11. A new plugin version does not inherit an exception for its predecessor. All other peer requirements remain subject to strict validation. CI runs `pnpm peers check --lockfile-only` immediately after installation: pnpm 11.22.0 can skip resolution peer checks during a frozen install, so a successful frozen install alone does not prove that peer requirements pass. Do not use a global peer ignore, `allowAny`, forced installation, or advisory suppression.

## Reason and compatibility boundary

ESLint 9 has reached the end of its support period. `eslint-config-next` 16.4.0 includes an [upstream ESLint 10 adaptation](https://github.com/vercel/next.js/commit/907721a66e8b4174515445c27068d9835bd424d8), while the three retained plugin versions still declare peer support only through ESLint 9. The existing TypeScript parser and React Hooks plugin support ESLint 10.

The exceptions record a local compatibility decision for these installed versions. They do not change published peer declarations, establish an upstream support contract, or prove that every plugin rule works with ESLint 10. Keep the official Next adaptation in use and verify the rules and configuration that this project actually exercises. A need to change Next, patch additional plugin source, or weaken existing diagnostics requires a separate scope decision.

ESLint 10 changes configuration lookup and removes deprecated APIs. Compatibility therefore includes real CLI runs from the repository root and a nested directory, JavaScript/JSX parsing through Babel, JSX scope and imports, and accessibility diagnostics, in addition to the existing TypeScript and Next rule coverage. See [the ESLint 10 migration guide](https://eslint.org/docs/latest/use/migrate-to-10.0.0) and [pnpm's peer dependency rules](https://pnpm.io/settings/peer-dependencies#peerdependencyrulesallowedversions).

## Upgrade and verification procedure

1. Start a separate branch from current `main`. Record effective configurations, selected files, rule severities, parser and resolver behavior, TypeScript aliases, and ignores before upgrading. Preserve the 61 existing lint compatibility cases and their recorded expectations.
2. Update only ESLint and the internal dependency changes required by it. Verify the exact ESLint 10.12.0 lockfile resolution, the three scoped exceptions, and strict peer validation. Confirm that unrelated direct specifications and retained locked versions do not drift.
3. Install from the frozen lockfile, then run `pnpm peers check --lockfile-only` as a separate required CI step. Confirm that both existing patches apply byte-for-byte unchanged and that `fast-glob`, `micromatch`, and `braces` remain absent from the lockfile and installed graph. During migration, also check an isolated copy with one exception removed: the peer check must fail for that plugin rather than silently accepting the policy change. Keep this negative control out of the working project.
4. Compare the effective lint configuration and diagnostics with the recorded baseline. Add focused CLI lookup, Babel/JSX, accessibility, and import regressions. Do not disable or downgrade rules to obtain passing results.
5. Run formatting, lint, typecheck, all unit/component tests, deterministic evaluations, database/provider/MCP integration tests, production build, and desktop/mobile E2E. The pre-upgrade baseline is 83 unit/component tests, 10 integration tests, 10 browser tests, and 7 evaluation scenarios; new compatibility cases extend that baseline.
6. Run complete and production dependency audits and the Git history secret scan. A clean audit describes known advisories at the time of the check, not a guarantee against unknown vulnerabilities.
7. Open a separate PR using noreply commit metadata, wait for the full CI on its exact head commit, and report results and remaining compatibility limits. Leave the PR open until the owner approves merging.
8. After an approved merge, verify CI, branch protection, commit metadata, and an actual Dependabot job using the new default-branch policy. A passing PR install does not establish that a later updater job will succeed.

Validation results belong to the PR and its CI runs; this decision defines required checks rather than asserting that a future run has passed.

## Update policy and removal criteria

Keep ordinary ESLint minor and patch updates enabled in Dependabot. The existing semver-major ignore makes ESLint 11 and later major upgrades manual; TypeScript's separate major-version boundary remains unchanged. Preserve security update attempts and alerts, with manual intervention when a compatibility boundary prevents automatic installation. The bounded provider range allows later 10.x updates to be proposed without replacing the exception on every patch release, but every update still needs installation and the full CI.

For each plugin, remove its exception when a published version declares ESLint 10 peer compatibility and the configuration and diagnostic regressions pass with that version. Review exceptions whenever a plugin or ESLint changes. Do not broaden a parent selector or extend the provider range to a future ESLint major without a separately reviewed migration. Once all three exceptions are removed, retain strict peer checks.
