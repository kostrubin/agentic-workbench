// @vitest-environment jsdom
import React from "react";
import { it, expect, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { Result } from "../src/features/workbench/result";
import type { Run } from "../src/lib/types";
it("opens the exact cited excerpt and disables saving incomplete runs", async () => {
  const onCitation = vi.fn();
  const run: Run = {
    id: "1",
    taskId: "2",
    status: "failed",
    answer: "Claim [1]. <script>alert(1)</script>",
    activities: [],
    citations: [
      {
        label: 1,
        chunkId: "3",
        documentId: "4",
        title: "Evidence",
        excerpt: "Source text",
      },
    ],
    provider: "demo",
    model: "test",
    startedAt: new Date().toISOString(),
    completedAt: null,
    latencyMs: null,
    contextTokens: 20,
    retrievalCount: 1,
    usage: null,
    error: "Incomplete",
  };
  const { container } = render(
    <Result
      run={run}
      onCitation={onCitation}
      onCopy={() => {}}
      onSave={() => {}}
      onRetry={() => {}}
      busy={false}
      saved={false}
    />,
  );
  fireEvent.click(
    await screen.findByRole("button", { name: "Open citation 1: Evidence" }),
  );
  expect(onCitation).toHaveBeenCalledWith(run.citations[0]);
  expect(container.querySelector("script")).toBeNull();
  expect(
    (screen.getByRole("button", { name: "Save note" }) as HTMLButtonElement)
      .disabled,
  ).toBe(true);
  cleanup();
});
