# Engineering handoff

## Built

A complete local research workspace: projects, notes/text/Markdown/PDF ingestion, indexed retrieval, bounded context, typed tools, streamed cited briefs, execution history, cancellation/retry, saved notes, a provider adapter, and optional MCP. Desktop and mobile screenshots are in `docs/screenshots/`.

## Architecture and structure

Next.js serves the initial workspace and validated routes. A custom TypeScript orchestrator runs a fixed sequence with a provider-neutral plan/synthesis contract. Drizzle and PostgreSQL store documents, chunks, tasks, runs, citation snapshots, and tool records. Components own presentation; a dedicated client hook owns interaction state and streaming. See the README repository map and `architecture.md`.

## Run commands

```sh
cp .env.example .env
pnpm install --frozen-lockfile
docker compose up -d --wait
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Use Node 24+ and pnpm 11.22.0. Open `http://localhost:3000`. Production: `pnpm build && pnpm start`.

## Demo and real AI

Demo mode is enabled by default and needs no paid service. Open Northstar architecture and start the prefilled comparison. Source retrieval and tools actually execute; the narrative is deterministic and labeled.

Provider mode needs `AI_MODE=provider`, `AI_PROVIDER=openai-compatible`, `AI_API_KEY`, `AI_MODEL`, and `AI_BASE_URL`. Restart after changing environment variables. The endpoint must support Chat Completions, JSON-schema output, and streaming. No real paid-provider smoke test has been performed.

## MCP

Implemented and independently tested. Run `pnpm mcp`, set `MCP_URL=http://127.0.0.1:4318/mcp`, and restart the web app. Arithmetic tasks cross-check via the discovered, allowlisted calculator. Failures do not break native research. Remove `MCP_URL` to disable.

## Validation

See `validation.md` for executed checks. Commands: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm eval`, `pnpm test:integration`, `pnpm build`, `pnpm test:e2e`. The CI workflow uses a fresh PostgreSQL service and requires no provider secrets.

## Major decisions

- Explicit bounded orchestration instead of a large agent framework.
- One PostgreSQL database for persistence and indexed lexical retrieval.
- Evidence diversity and budget enforcement before synthesis.
- A common execution path for deterministic and real providers.
- Server-owned data/secrets with client-owned streaming interaction.
- Authored CSS and restrained components; no unnecessary state or UI framework.
- Compatible TypeScript/lint toolchain pins instead of suppressing errors.

## Limits and next increments

This is single-user local software. Internet deployment requires authentication, tenant controls, quotas, isolated PDF processing, and a stronger CSP. Execution is request-bound; add a queue/event log for durable resumable runs. Retrieval is English lexical search, not semantic search. Citation validation checks labels, not entailment. History is limited to the latest 50 tasks. There is no OCR, source editing/deletion, web search, or generic untrusted MCP tool installation.

Prioritize authenticated deployment and durable execution, then a labeled retrieval/answer benchmark, source versioning, and pagination. Add hybrid retrieval only after measuring a need.

## Interview walkthrough: five things to highlight

1. **A model does not own the control plane.** Show the validated plan, explicit tool allowlist, bounded execution, and the separation between user-authorized writes and model-selected reads.
2. **Context is an engineered artifact.** Walk through ranking, diversity, deduplication, token estimates, and immutable citation snapshots. Explain what reference validation cannot prove.
3. **Failure is part of the product.** Demonstrate cancellation, persisted partial output, optional MCP failure, a retry as a new run, and the database concurrency constraint.
4. **The free demo exercises real infrastructure.** Explain the shared provider contract, real PostgreSQL retrieval, protocol tests, and why deterministic evaluations are not model benchmarks.
5. **Own the entire vertical slice.** Connect responsive UI and safe rendering to API validation, relational migrations, observability, E2E/accessibility tests, CI, and clear deployment boundaries.
