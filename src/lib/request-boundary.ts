/** Trusted local identity only: block hostile Host headers (DNS rebinding) and browser origins. */
export function isLocalRequest(request: Request): boolean {
  const expected = new URL(request.url);
  expected.host = request.headers.get("host") ?? expected.host;
  if (!["localhost", "127.0.0.1", "[::1]"].includes(expected.hostname))
    return false;
  const origin = request.headers.get("origin");
  return !origin || origin === expected.origin;
}
