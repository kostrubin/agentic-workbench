# Architecture

## Boundaries and ownership

`app/page.tsx` resolves the selected workspace on the server. The database repository owns authorization against the local identity, parameterized retrieval, ingestion transactions, and serialization. A Server Component loads initial state; the browser owns selection, dialogs, draft prompts, and transient streamed text. The workspace ID and task ID live in the URL. React local state is sufficient; there is no global store.

`use-workbench.ts` is the UI controller. Presentation is divided into navigation, welcome view, dialogs, evidence, result, and inspector components. Route handlers validate input before domain operations. Neither provider SDKs nor database clients are imported by the browser. PDF parsing is dynamically imported only for a PDF upload. Typography uses system fonts, avoiding network font dependencies.

## Domain

- `users`: one named local reviewer; replace this boundary with an authenticated principal for deployment.
- `workspaces`: owner, name, description.
- `documents`: normalized text, title, kind, SHA-256 content fingerprint, workspace.
- `chunks`: source ID, ordinal, text; a GIN index covers the English text vector.
- `tasks`: user prompt and workspace. A retry creates another run for the same task.
- `runs`: answer/result, public activities, selected citation snapshots, status, model/provider, timestamps, usage, retrieval count, context estimate, and sanitized error.
- `tool_executions`: run ID, allowlisted tool name, status, duration, and public summary.

Results are not chat messages: each task has independent executions. Citations are JSONB snapshots in the run so later source lifecycle changes cannot silently rewrite the evidence of an old decision. Foreign keys cascade only when the enclosing workspace is removed administratively. There is no destructive user-facing operation.

SQL migrations execute under a transaction and advisory lock. The migration name is recorded atomically. Drizzle maps the same schema for application queries. A partial unique index allows one running execution per task; it is the final concurrency guard, beyond the HTTP preflight check.

## Control flow

1. Validate prompt and ownership; resolve/create a task.
2. Insert a running record before sending any stream data.
3. Request a Zod-validated plan with a query, comparison flag, current-time flag, and optional bounded calculator input.
4. Execute `searchWorkspace`, build context, and retrieve selected sections.
5. Execute only requested registered tools. Optional arithmetic/MCP failures are visible and isolated.
6. Stream public text from the selected provider. SDK reasoning parts are ignored.
7. Validate citation labels and required citation presence.
8. Persist terminal state before emitting `done`.

`createNote` is a user-initiated write capability; it is not exposed to the model's plan. All model-selected tools are read-only. No arbitrary tool names or expression evaluators can enter the plan.

## Streaming and failures

The route streams newline-delimited JSON over a POST response. A discriminated event contract carries run identity, activities, citations, text deltas, and completion. The client preserves incomplete lines across transport chunks. Answers checkpoint approximately once per second and after each activity; final state and citation validation are persisted before success is shown.

A composed signal combines request disconnection, stream cancellation, and a 90-second deadline. DB reads use a statement timeout; tools have an eight-second wrapper. PostgreSQL queries already in flight are not actively cancelled by the JavaScript signal, but are bounded by the database timeout. External SDK operations receive the signal. No retry of an already-partial answer is hidden from the user.

A stopped process cannot execute its cleanup handler. A workspace read marks running records older than two minutes failed, which also releases the active-run constraint. This is recovery on access, not a background queue. Durable execution is the next infrastructure step if the product moves beyond local review.

## Privacy and observability

The client receives public status labels and the final answer, not the provider's private reasoning, raw errors, API key, or full internal prompt. Source excerpts are intentionally visible to the local user. Provider mode sends selected evidence to the configured endpoint; demo mode has no AI network calls.

Tool duration, status, model, usage, context size, retrieved count, and overall latency are persisted. Server logs contain run IDs and safe metrics. The sample server is a local diagnostic integration with no authenticated remote MCP discovery.

## Operational envelope

This application is designed for a trusted local machine and a small document collection. A public GitHub repository does not imply a public SaaS endpoint. Both CLI launch scripts bind loopback; request guards reject non-loopback Host names. Authentication, database row-level authorization for multiple tenants, shared limits, durable queues, telemetry retention, upload worker isolation, and security review precede hosted deployment.

## API surface

| Endpoint                             | Purpose                               |
| ------------------------------------ | ------------------------------------- |
| `GET /api/workspaces?workspace=<id>` | Refresh current workspace and history |
| `POST /api/workspaces`               | Create a local workspace              |
| `POST /api/documents`                | Import multipart text/note/PDF        |
| `POST /api/runs`                     | Start a task or retry; returns NDJSON |

The SSR page is dynamic and does not cache mutable workspace content across users. Static application assets retain Next's normal caching. There are no model calls during initial page rendering.
