import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next");

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      // Explicit `next` param wins (e.g. /reset-password from a recovery link).
      // Otherwise fall back to role-based default.
      if (nextParam) {
        return NextResponse.redirect(`${origin}${nextParam}`);
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .single();

        const redirectTo = profile?.role === "admin" ? "/admin" : "/portal";
        return NextResponse.redirect(`${origin}${redirectTo}`);
      }
    }
  }

  // Something went wrong — redirect to login with error
  return NextResponse.redirect(`${origin}/login?error=auth`);
}
