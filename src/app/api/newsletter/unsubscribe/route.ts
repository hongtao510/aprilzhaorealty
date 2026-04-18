import { NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function handleUnsubscribe(token: string | null) {
  const tokenValid = !!token && UUID_RE.test(token);

  if (tokenValid) {
    const supabase = createAdminClient();
    // Idempotent: set to empty array regardless of current state
    await supabase
      .from("profiles")
      .update({ newsletter_cities: [] })
      .eq("unsubscribe_token", token);
  }

  // Always render the same page so token existence isn't leaked
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<title>Unsubscribed — April Zhao Realty</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<style>
  body { margin:0; padding:0; background:#f5f5f0; font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Arial,sans-serif; }
  .wrap { max-width:560px; margin:80px auto; background:#fff; padding:56px 32px; text-align:center; border-top:3px solid #d4a012; }
  h1 { font-family: "Playfair Display", Georgia, serif; font-size:28px; color:#1a1a1a; margin:0 0 12px; font-weight:500; }
  p { color:#666; font-size:15px; line-height:1.6; margin:0 0 16px; }
  a { color:#d4a012; text-decoration:underline; }
  .eyebrow { font-size:11px; letter-spacing:3px; color:#d4a012; text-transform:uppercase; margin-bottom:8px; }
</style>
</head>
<body>
  <div class="wrap">
    <p class="eyebrow">April Zhao Realty</p>
    <h1>You've been unsubscribed</h1>
    <p>You'll no longer receive new-listing emails from us.</p>
    <p>Changed your mind? <a href="/login">Sign in</a> and pick the cities you want to hear about.</p>
  </div>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

export async function GET(request: NextRequest) {
  return handleUnsubscribe(request.nextUrl.searchParams.get("token"));
}

// RFC 8058 One-Click unsubscribe — Gmail/Apple Mail POST here
export async function POST(request: NextRequest) {
  return handleUnsubscribe(request.nextUrl.searchParams.get("token"));
}
