import { createUtilityApp } from "./server";
createUtilityApp().listen(4318, "127.0.0.1", () =>
  console.log("Workbench MCP listening at http://127.0.0.1:4318/mcp"),
);
