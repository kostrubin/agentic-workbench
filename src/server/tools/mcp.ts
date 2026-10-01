import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { z } from "zod";
import { calculatorInput } from "./registry";
export async function mcpCalculator(raw: unknown, signal: AbortSignal) {
  const input = calculatorInput.parse(raw);
  const address = process.env.MCP_URL;
  if (!address) throw new Error("MCP is disabled.");
  const url = new URL(address);
  if (
    !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
    url.protocol !== "http:"
  )
    throw new Error(
      "The sample MCP adapter only trusts loopback HTTP endpoints.",
    );
  const client = new Client({ name: "agentic-workbench", version: "1.0.0" });
  try {
    await client.connect(new StreamableHTTPClientTransport(url), {
      signal,
      timeout: 5000,
    });
    const discovery = await client.listTools({}, { signal, timeout: 5000 });
    const tool = discovery.tools.find((t) => t.name === "calculator");
    if (!tool || tool.inputSchema.type !== "object")
      throw new Error("Compatible calculator tool was not discovered.");
    // Narrow allowlist: arbitrary discovered tools are never added to the executable registry.
    const properties = tool.inputSchema.properties;
    if (!properties || !["a", "b", "operation"].every((k) => k in properties))
      throw new Error("Incompatible MCP schema.");
    const response = await client.callTool(
      { name: "calculator", arguments: input },
      undefined,
      { signal, timeout: 5000 },
    );
    if (response.isError) throw new Error("MCP calculation failed.");
    return z
      .object({ value: z.number().finite(), expression: z.string().max(200) })
      .parse(response.structuredContent);
  } finally {
    await client.close();
  }
}
