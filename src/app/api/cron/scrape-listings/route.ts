import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { scrapeAllCities, type RedfinListing } from "@/lib/redfin-listings";
import { escapeHtml } from "@/lib/email-templates";

// Hobby plan max is 60s; scraping 12 cities needs ~30s
export const maxDuration = 60;

/**
 * GET /api/cron/scrape-listings
 *
 * Daily cron job that scrapes active for-sale listings from Redfin
 * across all 12 featured cities. Upserts into Supabase and marks
 * new listings (not seen before) with is_new = true.
 *
 * Called by Vercel Cron daily at 7am PT (14:00 UTC).
 */
export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel sets this header for cron jobs)
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  const logs: string[] = [];
  const log = (msg: string) => {
    logs.push(msg);
    console.log(`[scrape-listings] ${msg}`);
  };

  log("Starting daily listing scrape...");

  // 1. Mark all existing listings as not new (they were new yesterday)
  const { error: resetError } = await supabase
    .from("redfin_listings")
    .update({ is_new: false })
    .eq("is_new", true);

  if (resetError) {
    log(`Warning: failed to reset is_new flags: ${resetError.message}`);
  }

  // 2. Scrape all cities
  const cityResults = await scrapeAllCities(log);

  // 3. Upsert each listing into Supabase
  let totalNew = 0;
  let totalUpdated = 0;
  let totalErrors = 0;

  for (const { city, listings } of cityResults) {
    for (const listing of listings) {
      try {
        // Check if this listing already exists (by redfin_url)
        const { data: existing } = await supabase
          .from("redfin_listings")
          .select("id, first_seen_at")
          .eq("redfin_url", listing.redfin_url)
          .maybeSingle();

        if (existing) {
          // Update existing listing (price may have changed, days_on_market updates, etc.)
          await supabase
            .from("redfin_listings")
            .update({
              price: listing.price,
              beds: listing.beds,
              baths: listing.baths,
              sqft: listing.sqft,
              lot_sqft: listing.lot_sqft,
              price_per_sqft: listing.price_per_sqft,
              hoa_per_month: listing.hoa_per_month,
              days_on_market: listing.days_on_market,
              status: listing.status,
              last_seen_at: new Date().toISOString(),
              is_new: false,
            })
            .eq("id", existing.id);
          totalUpdated++;
        } else {
          // Insert new listing
          await supabase.from("redfin_listings").insert({
            redfin_url: listing.redfin_url,
            address: listing.address,
            city: listing.city,
            state: listing.state,
            zip: listing.zip,
            price: listing.price,
            beds: listing.beds,
            baths: listing.baths,
            sqft: listing.sqft,
            lot_sqft: listing.lot_sqft,
            year_built: listing.year_built,
            price_per_sqft: listing.price_per_sqft,
            hoa_per_month: listing.hoa_per_month,
            property_type: listing.property_type,
            status: listing.status,
            days_on_market: listing.days_on_market,
            mls_number: listing.mls_number,
            latitude: listing.latitude,
            longitude: listing.longitude,
            first_seen_at: new Date().toISOString(),
            last_seen_at: new Date().toISOString(),
            is_new: true,
          });
          totalNew++;
        }
      } catch (err) {
        totalErrors++;
        if (totalErrors <= 5) {
          log(`Error upserting ${listing.address}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    }

    log(`${city}: ${listings.length} listings processed`);
  }

  // 4. Mark listings not seen today as potentially off-market
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const { data: staleListings } = await supabase
    .from("redfin_listings")
    .select("id")
    .eq("status", "active")
    .lt("last_seen_at", today.toISOString());

  if (staleListings && staleListings.length > 0) {
    const staleIds = staleListings.map((l) => l.id);
    await supabase
      .from("redfin_listings")
      .update({ status: "off-market" })
      .in("id", staleIds);
    log(`Marked ${staleIds.length} listings as off-market (not seen today)`);
  }

  log(`Done! New: ${totalNew}, Updated: ${totalUpdated}, Errors: ${totalErrors}`);

  // 5. Send daily email with new listings
  if (totalNew > 0) {
    try {
      await sendNewListingsEmail(totalNew, log);
      log("Daily email sent successfully");
    } catch (err) {
      log(`Email failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  } else {
    log("No new listings today — skipping email");
  }

  const summary = {
    new_listings: totalNew,
    updated_listings: totalUpdated,
    errors: totalErrors,
    cities_scraped: cityResults.length,
    total_listings: cityResults.reduce((sum, r) => sum + r.listings.length, 0),
  };

  return NextResponse.json({ success: true, summary, logs });
}

/**
 * Send a daily digest email to April with all new listings found today.
 */
async function sendNewListingsEmail(
  totalNew: number,
  log: (msg: string) => void,
) {
  const supabase = createAdminClient();

  // Fetch all new listings (is_new = true), grouped by city
  const { data: newListings, error } = await supabase
    .from("redfin_listings")
    .select("*")
    .eq("is_new", true)
    .order("city")
    .order("price", { ascending: false });

  if (error || !newListings?.length) {
    log("No new listings to email");
    return;
  }

  // Group by city
  const byCity: Record<string, typeof newListings> = {};
  for (const listing of newListings) {
    const city = listing.city || "Other";
    if (!byCity[city]) byCity[city] = [];
    byCity[city].push(listing);
  }

  const fmt = (n: number) => new Intl.NumberFormat("en-US").format(n);
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Build HTML email
  let listingsHtml = "";
  for (const [city, listings] of Object.entries(byCity)) {
    listingsHtml += `
      <tr>
        <td style="padding:20px 20px 8px 20px;">
          <h2 style="font-size:16px;color:#d4a012;text-transform:uppercase;letter-spacing:2px;margin:0;border-bottom:1px solid #e5e5e5;padding-bottom:8px;">
            ${escapeHtml(city)} (${listings.length} new)
          </h2>
        </td>
      </tr>`;

    for (const l of listings) {
      const priceStr = `$${fmt(l.price)}`;
      const details = [
        l.beds ? `${l.beds} bd` : null,
        l.baths ? `${l.baths} ba` : null,
        l.sqft ? `${fmt(l.sqft)} sqft` : null,
        l.lot_sqft ? `${fmt(l.lot_sqft)} sqft lot` : null,
        l.year_built ? `Built ${l.year_built}` : null,
      ].filter(Boolean).join(" &middot; ");

      listingsHtml += `
      <tr>
        <td style="padding:8px 20px;">
          <div style="border:1px solid #eee;padding:14px;border-radius:4px;">
            <a href="${escapeHtml(l.redfin_url)}" style="text-decoration:none;">
              <p style="font-size:18px;font-weight:bold;color:#1a1a1a;margin:0 0 4px 0;">${escapeHtml(priceStr)}</p>
              <p style="font-size:14px;color:#333;margin:0 0 4px 0;">${escapeHtml(l.address)}, ${escapeHtml(l.city)}</p>
              <p style="font-size:12px;color:#888;margin:0;">${details}</p>
            </a>
          </div>
        </td>
      </tr>`;
    }
  }

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background-color:#ffffff;">
    <tr>
      <td style="padding:30px 20px;text-align:center;border-bottom:2px solid #d4a012;">
        <p style="font-size:11px;text-transform:uppercase;letter-spacing:3px;color:#d4a012;margin:0 0 6px 0;">April Zhao Realty</p>
        <h1 style="font-size:22px;color:#1a1a1a;margin:0;font-weight:normal;">New Listings Today</h1>
        <p style="font-size:13px;color:#888;margin:8px 0 0 0;">${today}</p>
      </td>
    </tr>
    <tr>
      <td style="padding:20px;text-align:center;background-color:#faf8f0;">
        <p style="font-size:28px;font-weight:bold;color:#1a1a1a;margin:0;">${totalNew}</p>
        <p style="font-size:13px;color:#888;margin:4px 0 0 0;">new listings across ${Object.keys(byCity).length} cities</p>
      </td>
    </tr>
    ${listingsHtml}
    <tr>
      <td style="padding:20px;text-align:center;border-top:1px solid #e5e5e5;">
        <p style="font-size:11px;color:#999;margin:0;">Scraped from Redfin &middot; Sent via April Zhao Realty</p>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const resend = new Resend(process.env.RESEND_API_KEY);
  const to = (process.env.CONTACT_EMAIL || "aprilcasf@gmail.com")
    .split(",")
    .map((e) => e.trim());

  await resend.emails.send({
    from: "April Zhao Realty <onboarding@resend.dev>",
    to,
    subject: `${totalNew} New Listings — ${today}`,
    html,
  });

  log(`Email sent to ${to.join(", ")}: ${totalNew} new listings`);
}
