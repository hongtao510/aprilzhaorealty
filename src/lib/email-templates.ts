interface EmailHome {
  url: string;
  title?: string | null;
  image_url?: string | null;
  address?: string | null;
  price?: string | null;
  comment?: string;
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

export function buildHomeCard(home: EmailHome): string {
  const image = home.image_url
    ? `<img src="${escapeHtml(home.image_url)}" alt="${escapeHtml(home.address || "Home")}" style="width:100%;height:200px;object-fit:cover;display:block;" />`
    : `<div style="width:100%;height:200px;background-color:#f5f5f5;display:flex;align-items:center;justify-content:center;color:#ccc;font-size:48px;">&#8962;</div>`;

  const price = home.price
    ? `<p style="font-size:20px;font-weight:bold;color:#1a1a1a;margin:0 0 4px 0;">${escapeHtml(home.price)}</p>`
    : "";

  const address = home.address
    ? `<p style="font-size:14px;color:#666;margin:0 0 8px 0;">${escapeHtml(home.address)}</p>`
    : "";

  const comment = home.comment?.trim()
    ? `<blockquote style="margin:12px 0 0 0;padding:10px 14px;border-left:3px solid #d4a012;background-color:#faf8f0;color:#555;font-size:13px;font-style:italic;">${escapeHtml(home.comment)}</blockquote>`
    : "";

  return `
    <div style="border:1px solid #e5e5e5;margin-bottom:20px;overflow:hidden;">
      ${image}
      <div style="padding:16px;">
        ${price}
        ${address}
        <a href="${escapeHtml(home.url)}" style="display:inline-block;margin-top:8px;font-size:12px;text-transform:uppercase;letter-spacing:1px;color:#d4a012;text-decoration:none;">View Listing &rarr;</a>
        ${comment}
      </div>
    </div>`;
}

export function buildEmailHtml(homes: EmailHome[], message?: string): string {
  const homeCards = homes.map(buildHomeCard).join("");

  const personalMessage = message?.trim()
    ? `<div style="padding:20px 20px 0 20px;">
        <p style="font-size:14px;color:#333;line-height:1.6;margin:0;white-space:pre-line;">${escapeHtml(message.trim())}</p>
      </div>`
    : "";

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /></head>
<body style="margin:0;padding:0;background-color:#f5f5f5;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background-color:#ffffff;">
    <div style="padding:30px 20px;text-align:center;border-bottom:2px solid #d4a012;">
      <p style="font-size:12px;text-transform:uppercase;letter-spacing:3px;color:#d4a012;margin:0 0 6px 0;">April Zhao Realty</p>
      <h1 style="font-size:22px;color:#1a1a1a;margin:0;font-weight:normal;">Homes Shared With You</h1>
    </div>
    ${personalMessage}
    <div style="padding:20px;">
      ${homeCards}
    </div>
    <div style="padding:20px;text-align:center;border-top:1px solid #e5e5e5;">
      <p style="font-size:11px;color:#999;margin:0;">Sent via April Zhao Realty</p>
    </div>
  </div>
</body>
</html>`;
}

/** Listing row shape passed in from the cron route. */
export interface DigestListing {
  redfin_url: string;
  address: string;
  city: string;
  zip: string | null;
  price: number;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  year_built: number | null;
  days_on_market: number | null;
  image_url: string | null;
}

export interface DigestRecipient {
  email: string;
  full_name: string | null;
  unsubscribe_token: string;
}

/**
 * Build a personalized subscriber digest email.
 * siteUrl should be the canonical site origin, e.g. https://aprilzhaohome.com.
 */
export function buildSubscriberDigestHtml(
  recipient: DigestRecipient,
  listings: DigestListing[],
  siteUrl: string,
): string {
  const fmt = (n: number) => new Intl.NumberFormat("en-US").format(n);
  const today = new Date().toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const unsubscribeUrl = `${siteUrl}/api/newsletter/unsubscribe?token=${encodeURIComponent(recipient.unsubscribe_token)}`;
  const managePrefsUrl = `${siteUrl}/portal`;

  // Group by city for readability
  const byCity: Record<string, DigestListing[]> = {};
  for (const l of listings) {
    (byCity[l.city] ??= []).push(l);
  }

  let listingsHtml = "";
  for (const [city, rows] of Object.entries(byCity)) {
    listingsHtml += `
      <tr>
        <td style="padding:24px 20px 10px;">
          <h2 style="font-size:13px;color:#d4a012;text-transform:uppercase;letter-spacing:2px;margin:0;border-bottom:1px solid #e5e5e5;padding-bottom:8px;">
            ${escapeHtml(city)} &mdash; ${rows.length} new
          </h2>
        </td>
      </tr>`;

    for (const l of rows) {
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
                <p style="font-size:14px;color:#333;margin:0 0 6px 0;">${escapeHtml(l.address)}, ${escapeHtml(l.city)} ${escapeHtml(l.zip ?? "")}</p>
                <p style="font-size:12px;color:#999;margin:0;">${details}${l.days_on_market != null ? ` · ${l.days_on_market}d on market` : ""}</p>
              </a>
            </div>
          </div>
        </td>
      </tr>`;
    }
  }

  const greeting = recipient.full_name
    ? `Hi ${escapeHtml(recipient.full_name.split(" ")[0])},`
    : "Hello,";

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background-color:#f5f5f0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;margin:0 auto;background-color:#ffffff;">
    <tr>
      <td style="padding:32px 20px 24px;text-align:center;border-bottom:2px solid #d4a012;">
        <p style="font-size:11px;text-transform:uppercase;letter-spacing:3px;color:#d4a012;margin:0 0 8px 0;">April Zhao Realty</p>
        <h1 style="font-size:24px;color:#1a1a1a;margin:0;font-weight:600;">New Listings in Your Cities</h1>
        <p style="font-size:13px;color:#999;margin:8px 0 0 0;">${today}</p>
      </td>
    </tr>
    <tr>
      <td style="padding:20px 20px 0;">
        <p style="font-size:14px;color:#333;margin:0 0 12px;">${greeting}</p>
        <p style="font-size:14px;color:#666;margin:0 0 4px;">
          ${listings.length} new listing${listings.length !== 1 ? "s" : ""} matched your preferences today.
        </p>
      </td>
    </tr>
    ${listingsHtml}
    <tr>
      <td style="padding:28px 20px 24px;text-align:center;border-top:1px solid #e5e5e5;">
        <p style="font-size:12px;color:#666;margin:0 0 10px;">
          <a href="${escapeHtml(unsubscribeUrl)}" style="color:#666;text-decoration:underline;">Unsubscribe from these emails</a>
          &nbsp;·&nbsp;
          <a href="${escapeHtml(managePrefsUrl)}" style="color:#666;text-decoration:underline;">Update city preferences</a>
        </p>
        <p style="font-size:11px;color:#999;margin:0;">Scraped from Redfin · Sent by April Zhao Realty</p>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
