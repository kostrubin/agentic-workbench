import { createServer } from "node:http";
import { afterEach, it, expect, vi } from "vitest";
import { getProvider } from "../src/server/ai/provider";
afterEach(() => vi.unstubAllEnvs());
it("uses the real OpenAI-compatible adapter for structured plans and streamed text", async () => {
  const requests: Record<string, unknown>[] = [];
  const server = createServer(async (req, res) => {
    let body = "";
    for await (const chunk of req) body += chunk;
    const input = JSON.parse(body);
    requests.push(input);
    if (!input.stream) {
      res.setHeader("content-type", "application/json");
      res.end(
        JSON.stringify({
          id: "plan",
          object: "chat.completion",
          created: 1,
          model: "fixture",
          choices: [
            {
              index: 0,
              message: {
                role: "assistant",
                content: JSON.stringify({
                  query: "queue latency",
                  compare: false,
                  calculator: null,
                  currentTime: false,
                }),
              },
              finish_reason: "stop",
            },
          ],
          usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 },
        }),
      );
      return;
    }
    res.writeHead(200, { "content-type": "text/event-stream" });
    for (const text of ["## Evidence\n\n", "Use a queue. [1]"])
      res.write(
        "data: " +
          JSON.stringify({
            id: "synthesis",
            object: "chat.completion.chunk",
            created: 1,
            model: "fixture",
            choices: [
              { index: 0, delta: { content: text }, finish_reason: null },
            ],
          }) +
          "\n\n",
      );
    res.write(
      "data: " +
        JSON.stringify({
          id: "synthesis",
          object: "chat.completion.chunk",
          created: 1,
          model: "fixture",
          choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
          usage: { prompt_tokens: 50, completion_tokens: 12, total_tokens: 62 },
        }) +
        "\n\n",
    );
    res.end("data: [DONE]\n\n");
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string")
    throw new Error("Test server address missing");
  vi.stubEnv("AI_MODE", "provider");
  vi.stubEnv("AI_API_KEY", "local-fixture-key");
  vi.stubEnv("AI_MODEL", "fixture");
  vi.stubEnv("AI_BASE_URL", `http://127.0.0.1:${address.port}/v1`);
  try {
    const provider = getProvider();
    const signal = new AbortController().signal;
    expect((await provider.plan("Compare queues", signal)).query).toBe(
      "queue latency",
    );
    const stream = provider.synthesize(
      {
        prompt: "Why queues?",
        citations: [
          {
            label: 1,
            chunkId: "a",
            documentId: "b",
            title: "Queue",
            excerpt: "Use a queue.",
          },
        ],
        toolResults: [],
      },
      signal,
    );
    let text = "";
    while (true) {
      const part = await stream.next();
      if (part.done) {
        expect(part.value.inputTokens).toBe(70);
        break;
      }
      text += part.value;
    }
    expect(text).toBe("## Evidence\n\nUse a queue. [1]");
    expect(requests).toHaveLength(2);
    expect(requests[0]).toHaveProperty("response_format");
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
