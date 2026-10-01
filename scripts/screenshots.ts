import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import type { Bootstrap } from "../src/lib/types";
const base = "http://127.0.0.1:3000";
const response = await fetch(base + "/api/workspaces");
if (!response.ok)
  throw new Error("Start the application before capturing screenshots.");
const data = (await response.json()) as Bootstrap;
const task = data.tasks.find((task) => task.runs[0]?.status === "completed");
if (!task)
  throw new Error(
    "Complete a research task before capturing the result screenshots.",
  );
await mkdir("docs/screenshots", { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
  });
  await page.goto(base);
  await page
    .getByRole("heading", { name: "Clarity starts with good evidence." })
    .waitFor();
  await page.screenshot({
    path: "docs/screenshots/workspace.png",
    fullPage: true,
  });
  await page.goto(`${base}/?workspace=${data.activeWorkspace}&task=${task.id}`);
  await page
    .getByRole("button", { name: /Open citation/ })
    .first()
    .click();
  await page.screenshot({
    path: "docs/screenshots/research.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Run details", exact: true }).click();
  await page.getByText("Execution record").waitFor();
  await page.screenshot({
    path: "docs/screenshots/inspector.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page
    .getByRole("button", { name: /Open citation/ })
    .first()
    .waitFor();
  await page.screenshot({
    path: "docs/screenshots/mobile.png",
    fullPage: true,
  });
  console.log("Saved workspace, research, inspector, and mobile screenshots.");
} finally {
  await browser.close();
}
