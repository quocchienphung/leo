import { NextResponse, type NextRequest } from "next/server";

// Source router: `{ path: "/Playground", redirect: "/playground" }`. `redirects()` in
// next.config matches case-insensitively and loops on `/playground`, so compare exactly here.
export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname !== "/Playground") return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = "/playground";
  return NextResponse.redirect(url, 307);
}

export const config = {
  matcher: ["/Playground", "/playground"],
};
