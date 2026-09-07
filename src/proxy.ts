import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

function withTimeout<T>(promise: PromiseLike<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Middleware query timed out")), ms)
    ),
  ]);
}

const publicRoutes = [
  "/",
  "/listings",
  "/about",
  "/contact",
  "/testimonials",
  "/privacy",
  "/signup",
  "/reset-password",
  "/api/contact",
  "/api/auth",
  "/api/cron",
  "/api/newsletter",
];

function isPublicRoute(pathname: string) {
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/icon") ||
    pathname.startsWith("/images") ||
    pathname.startsWith("/apple-touch-icon") ||
    pathname.match(/\.(svg|png|jpg|jpeg|gif|ico|css|js|woff|woff2)$/)
  ) {
    return true;
  }

  return publicRoutes.some(
    (route) => pathname === route || pathname.startsWith(route + "/")
  );
}

function authUnavailableResponse(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api/")) {
    return NextResponse.json(
      { error: "Authentication service temporarily unavailable" },
      { status: 503 }
    );
  }

  return new NextResponse(
    `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Service temporarily unavailable</title>
  </head>
  <body style="font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; min-height: 100vh; display: grid; place-items: center; background: #fafafa; color: #171717;">
    <main style="max-width: 32rem; padding: 2rem; text-align: center;">
      <h1 style="font-size: 1.5rem; margin: 0 0 0.75rem;">Service temporarily unavailable</h1>
      <p style="line-height: 1.6; margin: 0; color: #525252;">We could not verify access right now. Please refresh in a moment.</p>
    </main>
  </body>
</html>`,
    {
      status: 503,
      headers: {
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-store",
      },
    }
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Public routes — pass through without hitting Supabase
  if (isPublicRoute(pathname)) {
    return NextResponse.next();
  }

  // Auth-protected routes — wrap in timeout so Supabase latency never causes 504
  let user, supabase, supabaseResponse;
  try {
    const session = await withTimeout(updateSession(request), 3000);
    user = session.user;
    supabase = session.supabase;
    supabaseResponse = session.supabaseResponse;
  } catch (error) {
    console.error("Middleware session verification failed:", error);
    return authUnavailableResponse(request);
  }

  // Login page — redirect to portal if already logged in
  if (pathname === "/login") {
    if (user) {
      try {
        const { data: profile } = await withTimeout(
          supabase
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .single(),
          3000
        );

        const redirectTo =
          profile?.role === "admin" ? "/admin" : "/portal";
        return NextResponse.redirect(new URL(redirectTo, request.url));
      } catch {
        // If profile fetch fails/times out, default to portal
        return NextResponse.redirect(new URL("/portal", request.url));
      }
    }
    return supabaseResponse;
  }

  // Protected routes — require auth
  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // API routes handle their own role checks — skip middleware profile query
  if (pathname.startsWith("/api/")) {
    return supabaseResponse;
  }

  // Role-based access for page routes
  try {
    const { data: profile } = await withTimeout(
      supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single(),
      3000
    );

    if (pathname.startsWith("/admin") && profile?.role !== "admin") {
      return NextResponse.redirect(new URL("/portal", request.url));
    }

    if (pathname.startsWith("/portal") && profile?.role !== "client") {
      if (profile?.role !== "admin") {
        return NextResponse.redirect(new URL("/login", request.url));
      }
    }
  } catch (error) {
    console.error("Middleware profile verification failed:", error);
    return authUnavailableResponse(request);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
