# MCP integration

MCP is a protocol boundary for independently running tools. Native tools remain simpler for local domain operations; routing every internal function through HTTP would add latency without value.

The sample utility server exposes one bounded arithmetic tool with Zod input and structured output. It uses the official SDK's Streamable HTTP server transport in stateless JSON-response mode. `pnpm mcp` binds `127.0.0.1:4318`; it is not an internet-facing server and provides no OAuth implementation.

The adapter creates a client per invocation, connects to the configured loopback endpoint, calls `listTools`, finds the allowlisted calculator, checks object/input property compatibility, and maps the known contract into the native registry's schema. The local Zod schema validates every argument and result. The adapter does not implement generic JSON-Schema-to-code conversion or trust tool annotations as a security boundary.

Discovery cannot expand permissions: arbitrary tool names, shell tools, and remote endpoints are rejected. MCP results are untrusted evidence. A server error, timeout, incompatible schema, or invalid output becomes a failed optional timeline entry. The client is closed in a `finally` block. Native calculator output remains usable, and the research completes.

The integration test starts the actual Express/SDK server on an ephemeral loopback port, discovers and invokes it with the real SDK client, checks arithmetic output, verifies tool errors, and rejects a remote endpoint. No mock transport replaces this test.

For a future hosted version: authentication, configurable endpoint allowlists, connection pooling, DNS/IP validation, tenant-scoped credentials, and explicit approval policies for write-capable tools are separate design work.
