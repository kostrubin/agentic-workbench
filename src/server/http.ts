import { z } from "zod";
export class HttpError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
const buckets = new Map<string, { count: number; reset: number }>();
export function guard(request: Request) {
  const origin = request.headers.get("origin");
  const expected = new URL(request.url);
  expected.host = request.headers.get("host") ?? expected.host;
  if (!["127.0.0.1", "localhost", "[::1]"].includes(expected.hostname))
    throw new HttpError("Only local requests are allowed.", 403);
  if (origin && origin !== expected.origin)
    throw new HttpError("Cross-origin requests are not allowed.", 403);
  // Local identity, process-local limiter. Replace both at the authentication boundary for deployment.
  const key = "local-reviewer";
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.reset < now)
    buckets.set(key, { count: 1, reset: now + 60000 });
  else if (++bucket.count > 60)
    throw new HttpError("Too many requests. Try again in a minute.", 429);
}
export async function bodyBytes(
  request: Request,
  limit = 16000,
): Promise<Uint8Array> {
  if (Number(request.headers.get("content-length")) > limit)
    throw new HttpError("Request is too large.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError("Request body is required.");
  const parts: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      size += part.value.length;
      if (size > limit) {
        await reader.cancel();
        throw new HttpError("Request is too large.", 413);
      }
      parts.push(part.value);
    }
  } finally {
    reader.releaseLock();
  }
  const output = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}
export async function jsonBody(request: Request) {
  try {
    return JSON.parse(new TextDecoder().decode(await bodyBytes(request)));
  } catch (error) {
    if (error instanceof HttpError) throw error;
    throw new HttpError("Invalid JSON request.");
  }
}
export function apiError(error: unknown): Response {
  if (error instanceof HttpError)
    return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof z.ZodError)
    return Response.json(
      { error: "Check the required fields and their lengths." },
      { status: 400 },
    );
  return Response.json(
    {
      error:
        "The operation could not complete. Check the database connection and try again.",
    },
    { status: 500 },
  );
}
