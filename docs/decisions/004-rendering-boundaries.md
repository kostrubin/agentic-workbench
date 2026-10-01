# ADR 004: Server bootstrap, client interaction

Status: accepted.

Workspace data and secrets belong on the server; streamed deltas, dialogs, and current selection are highly interactive.

Use a dynamic Server Component for bootstrap and a focused client controller for interactions. Workspace/task IDs are URL state; drafts and dialogs are local state. No global state package is necessary. The expensive Markdown renderer loads on demand when a result exists; PDF parsing stays server-only and loads only for uploads. System fonts avoid network dependencies.

The selected workspace's source text and up to 50 tasks are initially serialized. This is appropriate for a small local collection, but larger libraries need lazy source reads, paginated history, and query-level projections. Do not cache mutable tenant content globally.
