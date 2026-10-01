import "dotenv/config";
import { readFile } from "node:fs/promises";
import { pool } from "../src/server/db/client";
const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(763142)");
  await client.query(
    "CREATE TABLE IF NOT EXISTS migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())",
  );
  const name = "0001_initial.sql";
  const { rowCount } = await client.query(
    "SELECT name FROM migrations WHERE name=$1",
    [name],
  );
  if (!rowCount) {
    await client.query(
      await readFile(new URL("../migrations/" + name, import.meta.url), "utf8"),
    );
    await client.query("INSERT INTO migrations(name) VALUES ($1)", [name]);
  }
  await client.query("COMMIT");
  console.log("Database migrations are current.");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  client.release();
  await pool.end();
}
