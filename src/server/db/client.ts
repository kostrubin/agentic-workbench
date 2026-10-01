import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";
const globalDb = globalThis as unknown as { workbenchPool?: Pool };
export const pool =
  globalDb.workbenchPool ??
  new Pool({
    connectionString:
      process.env.DATABASE_URL ??
      "postgresql://workbench:workbench@127.0.0.1:54329/workbench",
    max: 8,
    connectionTimeoutMillis: 5000,
    statement_timeout: 10000,
  });
if (process.env.NODE_ENV !== "production") globalDb.workbenchPool = pool;
export const db = drizzle(pool, { schema });
export const LOCAL_USER = "local-reviewer";
