import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { calculatorInput, calculate } from "../../src/server/tools/calculator";
export function createUtilityApp() {
  const app = createMcpExpressApp({ host: "127.0.0.1" });
  app.post("/mcp", async (req, res) => {
    const server = new McpServer({
      name: "workbench-utilities",
      version: "1.0.0",
    });
    server.registerTool(
      "calculator",
      {
        description: "Bounded arithmetic without code evaluation",
        inputSchema: calculatorInput,
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          openWorldHint: false,
        },
      },
      async (input) => {
        try {
          const output = calculate(input);
          return {
            content: [{ type: "text", text: JSON.stringify(output) }],
            structuredContent: output,
          };
        } catch {
          return {
            content: [
              { type: "text", text: "Calculation failed. Check operands." },
            ],
            isError: true,
          };
        }
      },
    );
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    res.on("close", () => {
      void transport.close();
      void server.close();
    });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch {
      if (!res.headersSent)
        res.status(500).json({ error: "MCP request failed" });
    }
  });
  app.get("/mcp", (_req, res) => {
    res.status(405).end();
  });
  app.delete("/mcp", (_req, res) => {
    res.status(405).end();
  });
  return app;
}
