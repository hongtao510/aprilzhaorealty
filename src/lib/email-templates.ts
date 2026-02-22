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
