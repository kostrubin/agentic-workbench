import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { examplePrompt } from "../src/server/seed-content";
const seeded = "b51b5000-0000-4000-8000-000000000001";
test("seeded research streams, cites sources, and survives navigation", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(`/?workspace=${seeded}`);
  await expect(
    page.getByRole("heading", { name: "Clarity starts with good evidence." }),
  ).toBeVisible();
  if (info.project.name === "desktop")
    await page.screenshot({
      path: "docs/screenshots/workspace.png",
      fullPage: true,
    });
  await page
    .getByRole("button", { name: "Start research", exact: true })
    .click();
  await expect(page.getByRole("button", { name: "Stop run" })).toBeVisible();
  await expect(
    page.getByText("Research complete. Your result has been saved."),
  ).toBeVisible({ timeout: 30000 });
  await expect(
    page.getByRole("heading", { name: "Start with a modular monolith" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: /Open citation/ })
    .first()
    .click();
  await expect(
    page
      .getByText("CITATION", { exact: false })
      .filter({ hasText: /CITATION \d/ })
      .first(),
  ).toBeVisible();
  if (info.project.name === "mobile")
    await page
      .getByRole("button", { name: "Close context panel", exact: true })
      .last()
      .click();
  else
    await page.screenshot({
      path: "docs/screenshots/research.png",
      fullPage: true,
    });
  await page.getByRole("button", { name: "Run details", exact: true }).click();
  await expect(page.getByText("Execution record")).toBeVisible();
  await expect(page.getByText(/^calculator · 40 × 10 = 400$/)).toBeVisible();
  const taskUrl = page.url();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Start with a modular monolith" }),
  ).toBeVisible();
  if (info.project.name === "mobile")
    await page.screenshot({
      path: "docs/screenshots/mobile.png",
      fullPage: true,
    });
  if (info.project.name === "mobile")
    await page.getByRole("button", { name: "Open navigation" }).click();
  await page.getByRole("button", { name: "New research" }).click();
  if (info.project.name === "mobile")
    await page.getByRole("button", { name: "Open navigation" }).click();
  await page
    .getByRole("button", { name: examplePrompt, exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(taskUrl);
  await expect(
    page.getByRole("heading", { name: "Start with a modular monolith" }),
  ).toBeVisible();
  const audit = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  expect(audit.violations).toEqual([]);
  expect(errors).toEqual([]);
});
test("creates a workspace, ingests a note, and saves the resulting brief", async ({
  page,
}, info) => {
  await page.goto("/");
  if (info.project.name === "mobile")
    await page.getByRole("button", { name: "Open navigation" }).click();
  await page
    .getByRole("button", { name: "Create workspace", exact: true })
    .click();
  await page
    .getByLabel("Workspace name")
    .fill(`E2E research ${info.project.name} ${Date.now()}`);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Create workspace" })
    .click();
  if (info.project.name === "mobile")
    await page.getByRole("button", { name: "Open context panel" }).click();
  await page.getByRole("button", { name: "Add source material" }).click();
  await page.getByLabel("Title", { exact: true }).fill("Queue decision");
  await page
    .getByLabel("Source text")
    .fill(
      "Durable queues reduce report latency. Use a worker for expensive report generation. Measure queue depth and retry failures.",
    );
  await page.getByRole("button", { name: "Add to workspace" }).click();
  await expect(page.getByText("Source added to your workspace.")).toBeVisible();
  if (info.project.name === "mobile")
    await page
      .getByRole("button", { name: "Close context panel", exact: true })
      .last()
      .click();
  await page
    .getByLabel("What would you like to investigate?")
    .fill("Summarize the queue decision and report latency constraints.");
  await page.getByRole("button", { name: "Start research" }).click();
  await expect(
    page.getByText("Research complete. Your result has been saved."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Save note", exact: true }).click();
  await expect(
    page.getByText("Research saved as a workspace note."),
  ).toBeVisible();
});
test("failed execution remains inspectable and can be retried from the UI", async ({
  page,
  request,
}) => {
  const response = await request.post("/api/runs", {
    data: { workspaceId: seeded, prompt: examplePrompt, fault: true },
  });
  expect(response.ok()).toBe(true);
  const events = (await response.text())
    .trim()
    .split("\n")
    .map((s) => JSON.parse(s));
  const first = events[0];
  expect(events.at(-1).run.status).toBe("failed");
  await page.goto(`/?workspace=${seeded}&task=${first.task.id}`);
  await expect(
    page.getByRole("region", { name: "Research result" }).getByRole("alert"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Rerun", exact: true }).click();
  await expect(
    page.getByText("Research complete. Your result has been saved."),
  ).toBeVisible();
  await expect(page.getByLabel("Select run")).toBeVisible();
});
test("cancellation persists and the result is not saveable", async ({
  page,
}) => {
  await page.goto(`/?workspace=${seeded}`);
  await page.getByRole("button", { name: "Start research" }).click();
  await expect(
    page.getByRole("heading", { name: examplePrompt }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Stop run" }).click();
  await expect(page.getByText("Run cancelled.", { exact: true })).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("Run cancelled. Partial output is retained."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Save note" })).toBeDisabled();
});
