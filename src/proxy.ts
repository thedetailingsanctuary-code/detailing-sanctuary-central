import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

/**
 * The lock on the whole app. Every request that is not on the public list
 * must carry a valid, signed session cookie - otherwise it is bounced to /login
 * (pages) or answered with 401 (API). Cron endpoints check their own secret.
 */
const PUBLIC_PATHS: RegExp[] = [
  /^\/login$/,
  /^\/offline$/,
  /^\/api\/auth\//,
  /^\/api\/cron\//,
  /^\/manifest\.webmanifest$/,
  /^\/sw\.js$/,
  /^\/\.well-known\//,
  /^\/icons\//,
  /^\/demo\//,
  /^\/favicon\.ico$/,
  /^\/robots\.txt$/,
];

const SESSION_COOKIE = "dsc_session";

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.some((re) => re.test(pathname))) return NextResponse.next();

  // Local preview only - never active in a production build.
  const demo = process.env.NODE_ENV !== "production" && process.env.DEMO_MODE === "true";
  if (demo) return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const secret = process.env.SESSION_SECRET;
  let ok = false;
  if (token && secret) {
    try {
      await jwtVerify(token, new TextEncoder().encode(secret));
      ok = true;
    } catch {
      ok = false;
    }
  }
  if (ok) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
