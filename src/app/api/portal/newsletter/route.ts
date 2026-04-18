import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { FEATURED_CITIES } from "@/lib/redfin-listings";
import { escapeHtml } from "@/lib/email-templates";

const VALID_CITIES = new Set(FEATURED_CITIES.map((c) => c.name));

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const cities: unknown = body?.cities;

  if (!Array.isArray(cities) || !cities.every((c): c is string => typeof c === "string")) {
    return NextResponse.json(
      { error: "Invalid payload: expected { cities: string[] }" },
      { status: 400 }
    );
  }

  const unique = Array.from(new Set(cities));
  const invalid = unique.filter((c) => !VALID_CITIES.has(c));
  if (invalid.length > 0) {
    return NextResponse.json(
      { error: `Unknown cities: ${invalid.join(", ")}` },
      { status: 400 }
    );
  }

  // Read the existing row so we know whether to fire the admin notification
  const { data: existing } = await supabase
    .from("profiles")
    .select("email, full_name, newsletter_approved, newsletter_notified_at")
    .eq("id", user.id)
    .single();

  const { error } = await supabase
    .from("profiles")
    .update({ newsletter_cities: unique })
    .eq("id", user.id);

  if (error) {
    return NextResponse.json(
      { error: "Failed to update preferences" },
      { status: 500 }
    );
  }

  // Fire admin notification on first non-empty save by an unapproved user
  const shouldNotify =
    unique.length > 0 &&
    existing &&
    !existing.newsletter_approved &&
    !existing.newsletter_notified_at;

  if (shouldNotify) {
    try {
      await notifyAdminOfPendingSubscriber({
        email: existing.email,
        fullName: existing.full_name,
        cities: unique,
      });
      // Mark as notified so subsequent saves don't re-ping
      const admin = createAdminClient();
      await admin
        .from("profiles")
        .update({ newsletter_notified_at: new Date().toISOString() })
        .eq("id", user.id);
    } catch (err) {
      console.error("Admin notification failed:", err);
      // Don't fail the user's save just because notification didn't go through
    }
  }

  return NextResponse.json({ cities: unique });
}

async function notifyAdminOfPendingSubscriber(args: {
  email: string;
  fullName: string | null;
  cities: string[];
}) {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const to = (process.env.CONTACT_EMAIL || "aprilcasf@gmail.com")
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://aprilzhaohome.com";

  const cityList = args.cities.map((c) => `<li>${escapeHtml(c)}</li>`).join("");
  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#f5f5f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:40px auto;background:#fff;">
    <tr>
      <td style="padding:32px 28px 16px;border-top:3px solid #d4a012;">
        <p style="font-size:11px;color:#d4a012;text-transform:uppercase;letter-spacing:3px;margin:0 0 8px;">April Zhao Realty</p>
        <h1 style="font-family:'Playfair Display',Georgia,serif;font-size:22px;color:#1a1a1a;margin:0 0 20px;font-weight:500;">New newsletter subscriber pending approval</h1>
        <p style="color:#444;font-size:14px;margin:0 0 8px;"><strong>${escapeHtml(args.fullName || "(no name)")}</strong></p>
        <p style="color:#666;font-size:13px;margin:0 0 16px;">${escapeHtml(args.email)}</p>
        <p style="color:#666;font-size:13px;margin:0 0 6px;">Wants emails for:</p>
        <ul style="color:#444;font-size:13px;margin:0 0 24px;padding-left:20px;">${cityList}</ul>
        <a href="${escapeHtml(siteUrl)}/admin/users" style="display:inline-block;padding:12px 24px;background:#d4a012;color:#fff;text-decoration:none;font-size:12px;text-transform:uppercase;letter-spacing:2px;">Review in Admin</a>
      </td>
    </tr>
    <tr>
      <td style="padding:18px 28px;border-top:1px solid #eee;">
        <p style="color:#999;font-size:11px;margin:0;">They won't receive any digest emails until you approve them.</p>
      </td>
    </tr>
  </table>
</body></html>`;

  await resend.emails.send({
    from: "April Zhao Realty <noreply@aprilzhaohome.com>",
    to,
    subject: `New subscriber pending: ${args.fullName || args.email}`,
    html,
  });
}
