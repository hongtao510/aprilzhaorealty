import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { scrapeAllCities, type RedfinListing } from "@/lib/redfin-listings";
import { buildSubscriberDigestHtml, type DigestListing, escapeHtml } from "@/lib/email-templates";

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

  // 3. Batch upsert listings into Supabase
  //    Old approach did individual SELECT+INSERT/UPDATE per listing (~1000 queries)
  //    which caused timeouts. Now we batch everything into a few queries.
  let totalNew = 0;
  let totalUpdated = 0;
  let totalErrors = 0;

  // Flatten and deduplicate scraped listings (overlapping city bounding boxes
  // can return the same listing twice)
  const seen = new Set<string>();
  const allListings = cityResults.flatMap(({ listings }) => listings).filter((l) => {
    if (!l.redfin_url || seen.has(l.redfin_url)) return false;
    seen.add(l.redfin_url);
    return true;
  });
  const allUrls = allListings.map((l) => l.redfin_url);

  // Fetch existing URLs in small chunks (large .in() queries exceed PostgREST limits)
  const existingUrls = new Set<string>();
  for (let i = 0; i < allUrls.length; i += 50) {
    const chunk = allUrls.slice(i, i + 50);
    const { data } = await supabase
      .from("redfin_listings")
      .select("redfin_url")
      .in("redfin_url", chunk);
    if (data) data.forEach((row) => existingUrls.add(row.redfin_url));
  }

  log(`Found ${existingUrls.size} existing listings in DB, ${allListings.length} scraped`);

  const now = new Date().toISOString();

  // Build full rows for upsert — all required columns included
  const rows = allListings
    .filter((l) => l.redfin_url)
    .map((listing) => ({
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
      first_seen_at: now,
      last_seen_at: now,
      is_new: !existingUrls.has(listing.redfin_url),
    }));

  // Batch upsert all listings in chunks of 50
  for (let i = 0; i < rows.length; i += 50) {
    const chunk = rows.slice(i, i + 50);
    const { error } = await supabase
      .from("redfin_listings")
      .upsert(chunk, { onConflict: "redfin_url", ignoreDuplicates: false });
    if (error) {
      totalErrors += chunk.length;
      log(`Upsert error (batch ${Math.floor(i / 50)}): ${error.message}`);
    } else {
      const newInChunk = chunk.filter((r) => r.is_new).length;
      totalNew += newInChunk;
      totalUpdated += chunk.length - newInChunk;
    }
  }

  for (const { city, listings } of cityResults) {
    log(`${city}: ${listings.length} listings`);
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

  // 5. Fetch photos for new listings (scrape first image from Redfin page)
  if (totalNew > 0) {
    try {
      await fetchPhotosForNewListings(supabase, log);
    } catch (err) {
      log(`Photo fetch failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  // 6. Send daily email with new listings
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

  // 7. Fan out personalized digests to subscribed users
  if (totalNew > 0) {
    try {
      await sendSubscriberDigests(log);
    } catch (err) {
      log(`Subscriber fan-out failed: ${err instanceof Error ? err.message : String(err)}`);
    }
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
 * Scrape the first listing photo from each new listing's Redfin page.
 */
async function fetchPhotosForNewListings(
  supabase: ReturnType<typeof createAdminClient>,
  log: (msg: string) => void,
) {
  const { data: newListings } = await supabase
    .from("redfin_listings")
    .select("id, redfin_url")
    .eq("is_new", true)
    .is("image_url", null);

  if (!newListings?.length) return;
  log(`Fetching photos for ${newListings.length} new listings...`);

  let fetched = 0;
  for (const listing of newListings) {
    try {
      const resp = await fetch(listing.redfin_url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
          Referer: "https://www.redfin.com/",
        },
        signal: AbortSignal.timeout(5000),
      });
      const html = await resp.text();
      const match = html.match(
        /ssl\.cdn-redfin\.com\/photo\/[^"]*?(?:bigphoto|mbpaddedwide)[^"]*?\.(?:jpg|webp)/,
      );
      if (match) {
        const imageUrl = `https://${match[0]}`;
        await supabase
          .from("redfin_listings")
          .update({ image_url: imageUrl })
          .eq("id", listing.id);
        fetched++;
      }
    } catch {
      // Skip failures — photo is optional
    }
    // Small delay to avoid rate limiting
    await new Promise((r) => setTimeout(r, 300));
  }
  log(`Fetched ${fetched}/${newListings.length} listing photos`);
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

  // Build HTML email with listing photos
  let listingsHtml = "";
  for (const [city, listings] of Object.entries(byCity)) {
    listingsHtml += `
      <tr>
        <td style="padding:24px 20px 10px 20px;">
          <h2 style="font-size:13px;color:#d4a012;text-transform:uppercase;letter-spacing:2px;margin:0;border-bottom:1px solid #e5e5e5;padding-bottom:8px;">
            ${escapeHtml(city)} &mdash; ${listings.length} new
          </h2>
        </td>
      </tr>`;

    for (const l of listings) {
      const priceStr = `$${fmt(l.price)}`;
      const details = [
        l.beds ? `${l.beds} bd` : null,
        l.baths ? `${l.baths} ba` : null,
        l.sqft ? `${fmt(l.sqft)} sqft` : null,
        l.year_built ? `Built ${l.year_built}` : null,
      ].filter(Boolean).join(" · ");

      const imageBlock = l.image_url
        ? `<a href="${escapeHtml(l.redfin_url)}" style="text-decoration:none;">
             <img src="${escapeHtml(l.image_url)}" alt="${escapeHtml(l.address)}" style="width:100%;height:200px;object-fit:cover;display:block;border-radius:6px 6px 0 0;" />
           </a>`
        : `<div style="width:100%;height:120px;background:linear-gradient(135deg,#f0ece0,#e8e0cc);border-radius:6px 6px 0 0;display:flex;align-items:center;justify-content:center;">
             <span style="font-size:36px;color:#d4a012;">&#8962;</span>
           </div>`;

      listingsHtml += `
      <tr>
        <td style="padding:8px 20px;">
          <div style="border:1px solid #e5e5e5;border-radius:6px;overflow:hidden;">
            ${imageBlock}
            <div style="padding:14px 16px;">
              <a href="${escapeHtml(l.redfin_url)}" style="text-decoration:none;">
                <p style="font-size:22px;font-weight:bold;color:#1a1a1a;margin:0 0 2px 0;">${escapeHtml(priceStr)}</p>
                <p style="font-size:14px;color:#333;margin:0 0 6px 0;">${escapeHtml(l.address)}, ${escapeHtml(l.city)} ${escapeHtml(l.zip || "")}</p>
                <p style="font-size:12px;color:#999;margin:0;">${details}${l.days_on_market != null ? ` · ${l.days_on_market}d on market` : ""}</p>
              </a>
            </div>
          </div>
        </td>
      </tr>`;
    }
  }

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background-color:#f5f5f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background-color:#ffffff;">
    <tr>
      <td style="padding:32px 20px 24px;text-align:center;border-bottom:2px solid #d4a012;">
        <p style="font-size:11px;text-transform:uppercase;letter-spacing:3px;color:#d4a012;margin:0 0 8px 0;">April Zhao Realty</p>
        <h1 style="font-size:24px;color:#1a1a1a;margin:0;font-weight:600;">New Listings Today</h1>
        <p style="font-size:13px;color:#999;margin:8px 0 0 0;">${today}</p>
      </td>
    </tr>
    <tr>
      <td style="padding:20px;text-align:center;background-color:#faf8f0;">
        <p style="font-size:32px;font-weight:bold;color:#d4a012;margin:0;">${totalNew}</p>
        <p style="font-size:13px;color:#888;margin:4px 0 0 0;">new listing${totalNew !== 1 ? "s" : ""} across ${Object.keys(byCity).length} cit${Object.keys(byCity).length !== 1 ? "ies" : "y"}</p>
      </td>
    </tr>
    ${listingsHtml}
    <tr>
      <td style="padding:24px 20px;text-align:center;border-top:1px solid #e5e5e5;">
        <p style="font-size:11px;color:#999;margin:0;">Scraped from Redfin · Sent by April Zhao Realty</p>
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
    from: "April Zhao Realty <noreply@aprilzhaohome.com>",
    to,
    subject: `${totalNew} New Listings — ${today}`,
    html,
  });

  log(`Email sent to ${to.join(", ")}: ${totalNew} new listings`);
}

/**
 * Fan out a personalized, city-filtered digest to every user who has at least
 * one entry in profiles.newsletter_cities. One email per user via Resend batch.
 */
async function sendSubscriberDigests(log: (msg: string) => void) {
  const supabase = createAdminClient();

  const { data: subscribers, error: subErr } = await supabase
    .from("profiles")
    .select(
      "id, email, full_name, newsletter_cities, unsubscribe_token, filter_property_types, filter_min_price, filter_max_price, filter_min_beds, filter_min_baths, filter_min_sqft, filter_max_sqft"
    )
    .eq("newsletter_approved", true)
    .neq("newsletter_cities", "{}");

  if (subErr) {
    log(`Failed to fetch subscribers: ${subErr.message}`);
    return;
  }
  if (!subscribers?.length) {
    log("No approved subscribers to email");
    return;
  }

  const { data: newListings, error: listErr } = await supabase
    .from("redfin_listings")
    .select("redfin_url, address, city, zip, price, beds, baths, sqft, year_built, days_on_market, image_url, property_type")
    .eq("is_new", true);

  if (listErr || !newListings?.length) {
    log("No new listings to fan out");
    return;
  }

  // Cast once — property_type isn't in DigestListing but we use it for
  // filtering before passing to the template.
  type ListingWithType = DigestListing & { property_type: string | null };
  const allNew = (newListings ?? []) as ListingWithType[];

  const byCity: Record<string, ListingWithType[]> = {};
  for (const l of allNew) {
    (byCity[l.city] ??= []).push(l);
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://aprilzhaohome.com";
  const resend = new Resend(process.env.RESEND_API_KEY);

  type BatchItem = {
    from: string;
    to: string[];
    subject: string;
    html: string;
    headers: Record<string, string>;
  };

  const batch: BatchItem[] = [];
  for (const user of subscribers) {
    const cities = (user.newsletter_cities ?? []) as string[];
    const cityListings = cities.flatMap((c) => byCity[c] ?? []);

    // Apply per-user property filters (all AND'd; missing = no limit)
    const allowedTypes = (user.filter_property_types ?? []) as string[];
    const minPrice = user.filter_min_price as number | null;
    const maxPrice = user.filter_max_price as number | null;
    const minBeds = user.filter_min_beds as number | null;
    const minBaths = user.filter_min_baths as number | null;
    const minSqft = user.filter_min_sqft as number | null;
    const maxSqft = user.filter_max_sqft as number | null;

    const userListings: DigestListing[] = cityListings.filter((l) => {
      if (allowedTypes.length > 0) {
        if (!l.property_type || !allowedTypes.includes(l.property_type)) return false;
      }
      if (minPrice != null && l.price < minPrice) return false;
      if (maxPrice != null && l.price > maxPrice) return false;
      if (minBeds != null && (l.beds == null || l.beds < minBeds)) return false;
      if (minBaths != null && (l.baths == null || l.baths < minBaths)) return false;
      if (minSqft != null && (l.sqft == null || l.sqft < minSqft)) return false;
      if (maxSqft != null && (l.sqft != null && l.sqft > maxSqft)) return false;
      return true;
    });

    if (userListings.length === 0) continue;

    const unsubscribeUrl = `${siteUrl}/api/newsletter/unsubscribe?token=${encodeURIComponent(user.unsubscribe_token)}`;
    batch.push({
      from: "April Zhao Realty <noreply@aprilzhaohome.com>",
      to: [user.email],
      subject: `${userListings.length} new listing${userListings.length !== 1 ? "s" : ""} in your cities`,
      html: buildSubscriberDigestHtml(
        { email: user.email, full_name: user.full_name, unsubscribe_token: user.unsubscribe_token },
        userListings,
        siteUrl,
      ),
      headers: {
        "List-Unsubscribe": `<${unsubscribeUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    });
  }

  log(`Fanning out to ${batch.length} subscriber${batch.length !== 1 ? "s" : ""}...`);

  // Resend batch API accepts up to 100 emails per call
  for (let i = 0; i < batch.length; i += 100) {
    const chunk = batch.slice(i, i + 100);
    try {
      await resend.batch.send(chunk);
    } catch (err) {
      log(`Batch send failed (${i}): ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  log(`Sent ${batch.length} subscriber digest${batch.length !== 1 ? "s" : ""}`);
}
