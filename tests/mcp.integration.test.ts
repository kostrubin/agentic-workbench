import { afterEach, it, expect, vi } from "vitest";
import { createUtilityApp } from "../packages/mcp-server/server";
import { mcpCalculator } from "../src/server/tools/mcp";
afterEach(() => vi.unstubAllEnvs());
it("discovers and invokes the allowlisted tool over Streamable HTTP", async () => {
  const server = createUtilityApp().listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.on("listening", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Missing test address");
  vi.stubEnv("MCP_URL", `http://127.0.0.1:${address.port}/mcp`);
  try {
    expect(
      await mcpCalculator(
        { a: 40, b: 10, operation: "multiply" },
        new AbortController().signal,
      ),
    ).toEqual({ value: 400, expression: "40 × 10" });
    await expect(
      mcpCalculator(
        { a: 1, b: 0, operation: "divide" },
        new AbortController().signal,
      ),
    ).rejects.toThrow();
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
it("does not call untrusted remote endpoints", async () => {
  vi.stubEnv("MCP_URL", "https://example.com/mcp");
  await expect(
    mcpCalculator(
      { a: 1, b: 2, operation: "add" },
      new AbortController().signal,
    ),
  ).rejects.toThrow("loopback");
});
