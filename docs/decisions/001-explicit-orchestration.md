# ADR 001: Explicit orchestration

Status: accepted.

The workflow is short, bounded, and evidence-oriented. A large agent framework would hide state transitions that are important to review and test.

Use a typed planner → retrieval → tools → synthesis pipeline. Zod validates model-selected options; the application controls order and permissions. Providers implement a small interface. Synthesis cannot execute tools or writes. Stream events carry public labels only.

This makes limits and failure behavior visible, but does not support open-ended autonomous loops. Add another phase when a measured product need justifies it; do not infer permission from a model response.
