const ALLOWED_LISTING_HOSTS = ["redfin.com", "zillow.com", "realtor.com"];
const MAX_REDIRECTS = 3;
const MAX_HTML_BYTES = 2 * 1024 * 1024;

export class ListingUrlError extends Error {}

export function validateListingUrl(input: unknown): URL {
  if (typeof input !== "string" || !input.trim()) {
    throw new ListingUrlError("A listing URL is required");
  }

  let url: URL;
  try {
    url = new URL(input.trim());
  } catch {
    throw new ListingUrlError("Enter a valid listing URL");
  }

  if (url.protocol !== "https:") {
    throw new ListingUrlError("Listing URLs must use HTTPS");
  }

  const hostname = url.hostname.toLowerCase();
  const allowed = ALLOWED_LISTING_HOSTS.some(
    (host) => hostname === host || hostname.endsWith(`.${host}`)
  );
  if (!allowed) {
    throw new ListingUrlError("Only Redfin, Zillow, and Realtor.com listing URLs are supported");
  }

  url.hash = "";
  return url;
}

async function readHtml(response: Response): Promise<string> {
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_HTML_BYTES) {
    throw new ListingUrlError("The listing page is too large to import");
  }

  if (!response.body) throw new ListingUrlError("The listing page returned no content");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let html = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      received += value.byteLength;
      if (received > MAX_HTML_BYTES) {
        throw new ListingUrlError("The listing page is too large to import");
      }
      html += decoder.decode(value, { stream: true });
    }
    return html + decoder.decode();
  } finally {
    reader.releaseLock();
  }
}

/** Fetch trusted listing HTML without following redirects to an untrusted host. */
export async function fetchListingHtml(input: unknown, timeoutMs: number) {
  let url = validateListingUrl(input);

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount++) {
    const response = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      redirect: "manual",
      signal: AbortSignal.timeout(timeoutMs),
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) throw new ListingUrlError("The listing site returned an invalid redirect");
      if (redirectCount === MAX_REDIRECTS) {
        throw new ListingUrlError("The listing site redirected too many times");
      }
      url = validateListingUrl(new URL(location, url).toString());
      continue;
    }

    if (!response.ok) {
      throw new ListingUrlError("The listing page could not be retrieved");
    }

    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
      throw new ListingUrlError("The listing URL did not return an HTML page");
    }

    return { html: await readHtml(response), url: url.toString() };
  }

  throw new ListingUrlError("The listing page could not be retrieved");
}
