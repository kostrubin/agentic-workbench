# Security policy

## Supported versions

Security fixes target the latest revision of `main`, currently the 1.x application. Older commits and separately maintained release lines are not supported. Update to the latest revision before checking whether an issue remains reproducible.

## Report a vulnerability privately

Use [GitHub private vulnerability reporting](https://github.com/kostrubin/agentic-workbench/security/advisories/new). Please do not disclose an unpatched vulnerability in a public issue or pull request.

Include:

- The affected commit and relevant configuration, with secrets removed.
- A clear description of the security impact and the expected behavior.
- Minimal reproduction steps or a harmless proof of concept.
- Any suggested mitigation, if known.

Use synthetic documents and test credentials in reproductions. Do not attach live API keys, private documents, personal information, database dumps, or credentials belonging to anyone else. If a credential has already been exposed, revoke or rotate it first; removing a file or rewriting Git history does not invalidate a credential.

The maintainer will investigate reports and coordinate fixes and disclosure through the private advisory. This project has no guaranteed response or resolution time and no paid bug bounty. Ordinary bugs without a security impact can be reported in public issues with sanitized reproduction data.

## Intended deployment boundary

Agentic Workbench is a local, single-user application. The web application, PostgreSQL service, and optional sample MCP server bind to loopback. Local Host validation and workspace ownership checks are not a substitute for multi-user authentication or tenant authorization.

Do not expose this application or its database to the public internet as provided. A hosted deployment needs authentication, tenant isolation, storage and spending quotas, a shared rate limiter, stronger browser policy, and isolated PDF processing. The example database credentials are for local development only.

In demo mode, research uses the local database and deterministic synthesis. In provider mode, user prompts, selected document excerpts, and tool results are sent to the configured AI endpoint. Check the provider's handling of those contents before importing confidential material. API keys belong in the local environment; never put them in source files, screenshots, issues, or browser configuration.

Uploaded documents and model output are untrusted. Tool choices and inputs are constrained, and model-controlled writes or shell access are not provided. Those limits do not guarantee resistance to prompt injection or the truth of a generated answer. Citation validation checks references; it does not establish that a source supports every claim.

PDF parsing runs inside the application process with input and extraction limits. It has not been isolated for hostile public uploads. Use trusted PDFs locally; scanned PDFs require external OCR. An isolated worker with resource limits is required before accepting arbitrary public uploads.

The optional MCP integration permits only the known calculator tool at a loopback endpoint and validates its inputs and result. Extending it to remote servers or additional tools requires a separate review of access, authentication, and tool permissions.

## Repository safeguards

GitHub secret scanning and push protection are supplemented by a Gitleaks check of Git history. These checks detect known patterns, not every possible disclosure. Keep local environment files, private keys, database exports, and history backups out of source control. Use a GitHub `noreply` address for commits if you want to keep your personal email private.

Dependabot opens dependency and GitHub Actions updates for review; updates are not automatically merged. The TypeScript and ESLint major-version compatibility boundaries are intentional and must be revisited manually. Continuous integration exercises demo, local provider fixtures, and local MCP integration; it does not establish production deployment safety or test a paid AI endpoint.

## Lint dependency mitigation

The original Next ESLint plugin dependency chain included `fast-glob` → `micromatch` → `braces` 3.0.3, affected by [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm). The project removes that chain from the locked dependency graph using a version-scoped Next lint plugin patch and `tinyglobby`. No advisory suppression is configured. This is a local dependency adaptation, not a published upstream security fix.

Compatibility checks exercise the installed plugin's directory selection and actual lint diagnostics. A small `fdir` patch preserves directory-symlink enumeration in CJS and ESM; that patch also applies to other development tools sharing the same package version. Root-pattern expansion has explicit depth and output bounds. See [the migration decision](docs/decisions/006-next-lint-glob-migration.md) for scope, compatibility limits, and removal criteria. Reassess the patches when upgrading the lint stack; passing this suite does not prove equivalence for every possible glob or eliminate all resource-exhaustion risks.
