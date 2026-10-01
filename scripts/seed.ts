import "dotenv/config";
import { eq } from "drizzle-orm";
import { db, pool, LOCAL_USER } from "../src/server/db/client";
import { users, workspaces } from "../src/server/db/schema";
import { ingest } from "../src/server/db/repository";
import { seedDocuments } from "../src/server/seed-content";
try {
  await db
    .insert(users)
    .values({ id: LOCAL_USER, name: "Local reviewer" })
    .onConflictDoNothing();
  const id = "b51b5000-0000-4000-8000-000000000001";
  await db
    .insert(workspaces)
    .values({
      id,
      ownerId: LOCAL_USER,
      name: "Northstar architecture",
      description: "A decision brief for the next stage of growth.",
    })
    .onConflictDoNothing();
  for (const doc of seedDocuments)
    await ingest(id, doc.title, doc.content, doc.kind);
  const rows = await db.select().from(workspaces).where(eq(workspaces.id, id));
  console.log(
    `Seeded ${rows[0].name} with four source documents (idempotent).`,
  );
} finally {
  await pool.end();
}
