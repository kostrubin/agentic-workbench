# Evaluation

Run `pnpm eval` without a database or paid AI credentials. The seven assertions execute against the same chunker, context builder, demo planner, calculator, citation validator, and deterministic synthesis used by the application.

| Scenario             | Assertion                                                        |
| -------------------- | ---------------------------------------------------------------- |
| Citations            | At least four selected source references survive validation      |
| Arithmetic selection | Explicit 40 × 10 selects the calculator and returns 400          |
| Context engineering  | All four sources fit without exceeding the estimated budget      |
| Comparison           | The recommendation preserves the unproven scaling assumption     |
| Tool failure         | Division by zero raises a bounded error                          |
| Abstention           | Missing evidence does not produce a source-backed recommendation |
| Fabricated reference | An unregistered citation label is rejected                       |

These are application-level regression checks, not a model benchmark. The fixed Northstar synthesis deliberately makes them deterministic. They do not establish provider factuality, prompt-injection resistance, retrieval recall across arbitrary corpora, citation entailment, or useful reasoning.

`pnpm test:integration` adds real PostgreSQL ranking/isolation, orchestration transitions, checkpoints, tool records, concurrent-run exclusion, cancellation, failure/retry, and optional tool failure. A local provider protocol fixture exercises the actual AI SDK adapter; the MCP test exercises the actual Streamable HTTP transport.

`pnpm test:e2e` tests the production build in Chromium at desktop and mobile dimensions. It includes an explicit server-side fault to verify user-visible failure and retry. Fault injection is ignored unless the server process opts in through `ENABLE_TEST_FAULTS=true`; it is not a normal user feature.

Next evaluation increment: a labeled set of questions with expected evidence IDs, retrieval recall@k, citation precision/entailment, conflicting-evidence handling, and abstention rates. Add opt-in live-provider runs with a cost cap and versioned prompts; compare before adopting embeddings or a more autonomous planner.
