import { NextResponse, type NextRequest } from "next/server";
import { isLocalRequest } from "./lib/request-boundary";
export function proxy(request: NextRequest) {
  if (!isLocalRequest(request))
    return new NextResponse(
      "This workbench only accepts same-origin local requests.",
      { status: 403 },
    );
  return NextResponse.next();
}
export const config = { matcher: ["/", "/api/:path*"] };
