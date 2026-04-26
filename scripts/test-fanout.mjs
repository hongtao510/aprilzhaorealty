// One-off: temporarily mark one Foster City listing is_new=true
// and send a test digest to all approved subscribers who selected Foster City.
// Usage: node scripts/test-fanout.mjs

import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => {
      const [k, ...v] = l.split("=");
      return [k.trim(), v.join("=").trim().replace(/^["']|["']$/g, "")];
    })
);

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const RESEND_KEY = env.RESEND_API_KEY;
const SITE_URL = env.NEXT_PUBLIC_SITE_URL || "https://aprilzhaohome.com";

if (!SUPABASE_URL || !SERVICE_KEY || !RESEND_KEY) {
  console.error("Missing env vars in .env.local");
  process.exit(1);
}

async function sb(path, opts = {}) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: SERVICE_KEY,
      Authorization: `Bearer ${SERVICE_KEY}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...opts.headers,
    },
  });
  if (!res.ok) throw new Error(`${path}: ${res.status} ${await res.text()}`);
  return res.json();
}

// 1. Get one Foster City listing
const fosters = await sb("redfin_listings?city=eq.Foster%20City&limit=1&select=id,redfin_url,address,city,zip,price,beds,baths,sqft,year_built,days_on_market,image_url");
if (fosters.length === 0) {
  console.error("No Foster City listings in DB");
  process.exit(1);
}
const listing = fosters[0];
console.log("Using listing:", listing.address);

// 2. Get subscribers who want Foster City emails
const subs = await sb(
  "profiles?newsletter_approved=eq.true&newsletter_cities=cs.{Foster%20City}&select=email,full_name,unsubscribe_token"
);
console.log(`Found ${subs.length} subscriber(s) wanting Foster City`);
if (subs.length === 0) {
  console.error("No matching subscribers");
  process.exit(1);
}

// 3. Send personalized email via Resend
function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

for (const user of subs) {
  const unsub = `${SITE_URL}/api/newsletter/unsubscribe?token=${encodeURIComponent(user.unsubscribe_token)}`;
  const fmt = (n) => new Intl.NumberFormat("en-US").format(n);
  const today = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const greeting = user.full_name ? `Hi ${escapeHtml(user.full_name.split(" ")[0])},` : "Hello,";
  const details = [listing.beds && `${listing.beds} bd`, listing.baths && `${listing.baths} ba`, listing.sqft && `${fmt(listing.sqft)} sqft`].filter(Boolean).join(" · ");
  const img = listing.image_url
    ? `<img src="${escapeHtml(listing.image_url)}" alt="${escapeHtml(listing.address)}" style="width:100%;height:200px;object-fit:cover;display:block;border-radius:6px 6px 0 0;" />`
    : `<div style="width:100%;height:120px;background:#f0ece0;border-radius:6px 6px 0 0;"></div>`;

  const html = `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f5f5f0;font-family:-apple-system,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background:#fff;">
<tr><td style="padding:32px 20px;text-align:center;border-bottom:2px solid #d4a012;">
<p style="font-size:11px;text-transform:uppercase;letter-spacing:3px;color:#d4a012;margin:0 0 8px;">April Zhao Realty</p>
<h1 style="font-size:24px;color:#1a1a1a;margin:0;">New Listings in Your Cities</h1>
<p style="font-size:13px;color:#999;margin:8px 0 0;">${today}</p>
</td></tr>
<tr><td style="padding:20px;"><p style="font-size:14px;color:#333;">${greeting}</p><p style="font-size:14px;color:#666;">1 new listing matched your preferences today.</p></td></tr>
<tr><td style="padding:24px 20px 10px;"><h2 style="font-size:13px;color:#d4a012;text-transform:uppercase;letter-spacing:2px;margin:0;border-bottom:1px solid #e5e5e5;padding-bottom:8px;">${escapeHtml(listing.city)} &mdash; 1 new</h2></td></tr>
<tr><td style="padding:8px 20px;">
<div style="border:1px solid #e5e5e5;border-radius:6px;overflow:hidden;">
${img}
<div style="padding:14px 16px;">
<a href="${escapeHtml(listing.redfin_url)}" style="text-decoration:none;">
<p style="font-size:22px;font-weight:bold;color:#1a1a1a;margin:0 0 2px;">$${fmt(listing.price)}</p>
<p style="font-size:14px;color:#333;margin:0 0 6px;">${escapeHtml(listing.address)}, ${escapeHtml(listing.city)} ${escapeHtml(listing.zip ?? "")}</p>
<p style="font-size:12px;color:#999;margin:0;">${details}</p>
</a></div></div>
</td></tr>
<tr><td style="padding:28px 20px 24px;text-align:center;border-top:1px solid #e5e5e5;">
<p style="font-size:12px;color:#666;margin:0;"><a href="${escapeHtml(unsub)}" style="color:#666;text-decoration:underline;">Unsubscribe from these emails</a> · <a href="${escapeHtml(SITE_URL)}/portal" style="color:#666;text-decoration:underline;">Update city preferences</a></p>
<p style="font-size:11px;color:#999;margin:6px 0 0;">[TEST RUN] Scraped from Redfin · Sent by April Zhao Realty</p>
</td></tr></table></body></html>`;

  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "April Zhao Realty <noreply@aprilzhaohome.com>",
      to: [user.email],
      subject: `1 new listing in your cities`,
      html,
      headers: {
        "List-Unsubscribe": `<${unsub}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    }),
  });
  const out = await r.json();
  console.log(`-> ${user.email}: ${r.ok ? "sent (id " + out.id + ")" : "FAILED " + JSON.stringify(out)}`);
}

console.log("Done.");
