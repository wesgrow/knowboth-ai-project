import { createMiddlewareClient } from "@supabase/auth-helpers-nextjs";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC = ["/auth", "/_next", "/favicon", "/manifest", "/sw.js", "/icons"];

export default async function proxy(req: NextRequest) {
  const res = NextResponse.next();
  const supabase = createMiddlewareClient({ req, res });
  const { data: { session } } = await supabase.auth.getSession();
  const path = req.nextUrl.pathname;
  const isPublic = PUBLIC.some(p => path.startsWith(p));
  if (!session && !isPublic) return NextResponse.redirect(new URL("/auth", req.url));
  if (session && path === "/auth") return NextResponse.redirect(new URL("/home", req.url));
  if (session && path === "/") return NextResponse.redirect(new URL("/home", req.url));
  return res;
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };