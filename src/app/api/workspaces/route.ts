import { z } from "zod";
import { db, LOCAL_USER } from "@/server/db/client";
import { users, workspaces } from "@/server/db/schema";
import { bootstrap } from "@/server/db/repository";
import { guard, jsonBody, apiError } from "@/server/http";
export const runtime = "nodejs";
export async function GET(request: Request) {
  try {
    const id = new URL(request.url).searchParams.get("workspace") ?? undefined;
    if (id) z.uuid().parse(id);
    return Response.json(await bootstrap(id));
  } catch (error) {
    return apiError(error);
  }
}
export async function POST(request: Request) {
  try {
    guard(request);
    const input = z
      .object({ name: z.string().trim().min(2).max(60) })
      .parse(await jsonBody(request));
    await db
      .insert(users)
      .values({ id: LOCAL_USER, name: "Local reviewer" })
      .onConflictDoNothing();
    const [workspace] = await db
      .insert(workspaces)
      .values({
        ...input,
        ownerId: LOCAL_USER,
        description: "Your next decision starts here.",
      })
      .returning();
    return Response.json(workspace, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
