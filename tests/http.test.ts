import { it, expect } from "vitest";
import { bodyBytes, guard, jsonBody, apiError } from "../src/server/http";
it("blocks cross-origin writes", () => {
  expect(() =>
    guard(
      new Request("http://localhost/api", {
        headers: { origin: "https://attacker.example" },
      }),
    ),
  ).toThrow("Cross-origin");
});
it("rejects actual oversized bodies even with absent length headers", async () => {
  const request = new Request("http://localhost", {
    method: "POST",
    body: "x".repeat(20),
  });
  await expect(bodyBytes(request, 10)).rejects.toThrow("too large");
});
it("rejects malformed JSON", async () => {
  await expect(
    jsonBody(
      new Request("http://localhost", { method: "POST", body: "{broken" }),
    ),
  ).rejects.toThrow("Invalid JSON");
});
it("does not leak raw error details", async () => {
  const response = apiError(new Error("secret-key-test"));
  expect(await response.text()).not.toContain("secret-key-test");
});

import { isLocalRequest } from "../src/lib/request-boundary";
it("rejects DNS rebinding hosts on reads too", () => {
  expect(
    isLocalRequest(
      new Request("http://localhost", {
        headers: { host: "attacker.example" },
      }),
    ),
  ).toBe(false);
  expect(
    isLocalRequest(
      new Request("http://localhost:3000", {
        headers: { host: "127.0.0.1:3000", origin: "http://127.0.0.1:3000" },
      }),
    ),
  ).toBe(true);
});
