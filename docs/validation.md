# Validation record

Local validation on 2026-10-01, macOS ARM64, Node 24.11.0, pnpm 11.22.0, PostgreSQL 17 in Docker. Tests use deterministic fixtures and no paid model service.

| Check                                            | Result                                               |
| ------------------------------------------------ | ---------------------------------------------------- |
| Docker Compose PostgreSQL health                 | Passed                                               |
| Transactional migration and idempotent seed      | Passed                                               |
| Prettier formatting                              | Passed                                               |
| ESLint                                           | Passed, no warnings                                  |
| Strict TypeScript and Next route type generation | Passed                                               |
| Vitest unit/component tests                      | 21 passed                                            |
| Deterministic evaluations                        | 7 passed                                             |
| PostgreSQL/provider/MCP integration tests        | 10 passed                                            |
| Production Next.js build                         | Passed                                               |
| Chromium desktop/mobile E2E                      | 10 passed                                            |
| axe-core research-screen audit                   | No WCAG A/AA violations detected in the tested state |
| PDF extraction and invalid upload rejection      | Passed                                               |
| Live hosted provider                             | Not run; requires user-owned credentials             |
| Load testing / hosted Lighthouse score           | Not claimed                                          |

Screenshots are captured from the running application at 1440px desktop width and an emulated iPhone viewport. Visual inspection covered the workspace, completed brief, evidence panel, and mobile result. Automated accessibility checks do not replace a full keyboard/screen-reader audit.

The browser suite found and drove fixes for local-origin validation, insufficient phase-number contrast, and a cancellation acknowledgement race. Cancellation now waits for a persisted terminal record before reporting success. The suite also checks the arithmetic result shown in the tool timeline, rather than only a tool name.

The provider contract test uses the real AI SDK adapter against an ephemeral local HTTP fixture with structured output and SSE text. The MCP test uses the actual SDK client and sample HTTP server. These tests validate integrations and failure behavior, not a remote model's answer quality.

The GitHub Actions workflow runs the same checks in a fresh Linux/PostgreSQL environment. Consult the repository's Actions tab for the live result at a particular commit; local success does not imply remote success.
