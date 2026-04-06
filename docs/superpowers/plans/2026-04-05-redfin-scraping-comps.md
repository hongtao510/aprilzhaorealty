# Redfin Scraping for Verified Comp Data — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Claude's hallucinated comp prices with real sold data scraped from Redfin, with graceful fallback.

**Architecture:** A new `src/lib/redfin-scraper.ts` module handles data acquisition. **Firecrawl is the primary scraper** (works in Vercel serverless, handles anti-bot, returns structured data). **Playwright is a local-dev-only fallback** (requires Chromium binary, won't run on Vercel). If both fail, Claude knowledge is used as last resort (flagged "unverified"). The existing CMA route calls the scraper before Claude, then passes verified data to Claude for scoring/analysis only.

**Tech Stack:** Firecrawl REST API (primary), Playwright (local fallback), Next.js API route, Anthropic SDK

**Key design decisions from review:**
- Firecrawl primary because Playwright cannot run in Vercel serverless (50MB bundle limit, no persistent filesystem for Chromium)
- Firecrawl extract mode (structured JSON) instead of markdown parsing for reliability
- 20-second overall scraping timeout via `Promise.race`
- Scraping happens before the streaming/non-streaming branch to avoid `send()` scope issues

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `src/lib/redfin-scraper.ts` | Firecrawl (primary) + Playwright (local fallback) + unified interface |
| Modify | `src/lib/types.ts` | Add `RawComp` and `ScrapeResult` interfaces |
| Modify | `src/app/api/admin/candidate-homes/[id]/comps/route.ts` | Call scraper, update prompt to analyze-only, complete integration for both paths |
| Modify | `.env.local` | Add `FIRECRAWL_API_KEY` |
| Modify | `.env.example` | Add `FIRECRAWL_API_KEY` placeholder |

---

### Task 1: Install Dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install playwright as optional local-dev dependency**

```bash
cd /Users/taohong/Documents/aprilzhaorealty
npm install playwright --save-optional
```

Note: Playwright is optional — only used for local dev. In production (Vercel), Firecrawl is the primary path.

- [ ] **Step 2: Install Chromium browser for local development**

```bash
npx playwright install chromium
```

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add playwright as optional dependency for local Redfin scraping"
```

---

### Task 2: Add RawComp and ScrapeResult Types

**Files:**
- Modify: `src/lib/types.ts:155` (after `CompHome` interface)

- [ ] **Step 1: Add types to types.ts**

Add after the `CompHome` interface (line ~155):

```typescript
/** Raw comp data scraped from Redfin before Claude analysis */
export interface RawComp {
  address: string;
  sold_price: number;
  sold_date: string;       // YYYY-MM-DD
  sqft: number;
  beds: number;
  baths: number;
  lot_sqft: number | null; // may not be available from search results
  redfin_url: string;
}

/** Result from the scraping pipeline */
export interface ScrapeResult {
  comps: RawComp[];
  source: "firecrawl" | "playwright" | "claude-knowledge";
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: add RawComp and ScrapeResult types for scraped comp data"
```

---

### Task 3: Create Redfin Scraper — Firecrawl (Primary Path)

**Files:**
- Create: `src/lib/redfin-scraper.ts`

Firecrawl is the primary scraper. It uses Firecrawl's `/v1/scrape` endpoint with `formats: ["extract"]` and a JSON schema to get structured property data directly — no brittle markdown parsing.

- [ ] **Step 1: Create the scraper module with Firecrawl**

Create `src/lib/redfin-scraper.ts`:

```typescript
import type { RawComp, ScrapeResult } from "./types";

const MAX_COMPS = 20;
const SCRAPE_TIMEOUT = 20_000; // 20s total for all scraping attempts

/**
 * Build a Redfin "recently sold" search URL for a given zip code.
 * Filters: sold within 12 months, houses only, sorted by most recent.
 */
function buildRedfinUrl(zip: string): string {
  return `https://www.redfin.com/zipcode/${zip}/filter/include=sold-1yr,property-type=house/sort=lo-days`;
}

/** Format a number with commas for display (server-safe, no locale dependency). */
function formatNumber(n: number): string {
  return new Intl.NumberFormat("en-US").format(n);
}

/** Wrap a promise with a timeout. */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms)
    ),
  ]);
}

// --- Firecrawl Extract Schema ---
// Tells Firecrawl to return structured JSON matching this shape.
const EXTRACT_SCHEMA = {
  type: "object",
  properties: {
    properties: {
      type: "array",
      items: {
        type: "object",
        properties: {
          address: { type: "string", description: "Full street address including city, state, zip" },
          sold_price: { type: "number", description: "Sale price in dollars" },
          sold_date: { type: "string", description: "Sale date in YYYY-MM-DD format" },
          sqft: { type: "number", description: "Living area square footage" },
          beds: { type: "number", description: "Number of bedrooms" },
          baths: { type: "number", description: "Number of bathrooms" },
          lot_sqft: { type: "number", description: "Lot size in square feet, 0 if unknown" },
          redfin_url: { type: "string", description: "Full Redfin listing URL" },
        },
        required: ["address", "sold_price", "sqft", "beds", "baths"],
      },
    },
  },
  required: ["properties"],
};

/**
 * Primary scraper: use Firecrawl API to scrape Redfin.
 * Uses extract mode for structured JSON output — no fragile markdown parsing.
 */
export async function scrapeWithFirecrawl(
  zip: string,
  log?: (msg: string) => void,
): Promise<RawComp[]> {
  const info = log ?? console.log;
  const apiKey = process.env.FIRECRAWL_API_KEY;

  if (!apiKey) {
    throw new Error("FIRECRAWL_API_KEY not set");
  }

  const url = buildRedfinUrl(zip);
  info(`Firecrawl: scraping ${url}`);

  const response = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      url,
      formats: ["extract"],
      extract: { schema: EXTRACT_SCHEMA },
      waitFor: 5000,
      timeout: 15000,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Firecrawl API error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const extracted = data?.data?.extract;

  if (!extracted?.properties?.length) {
    throw new Error("Firecrawl returned no properties");
  }

  const comps: RawComp[] = extracted.properties
    .filter((p: Record<string, unknown>) => p.address && (p.sold_price as number) > 0 && (p.sqft as number) > 0)
    .slice(0, MAX_COMPS)
    .map((p: Record<string, unknown>) => ({
      address: String(p.address),
      sold_price: Number(p.sold_price),
      sold_date: String(p.sold_date ?? ""),
      sqft: Number(p.sqft),
      beds: Number(p.beds ?? 0),
      baths: Number(p.baths ?? 0),
      lot_sqft: p.lot_sqft ? Number(p.lot_sqft) : null,
      redfin_url: String(p.redfin_url ?? ""),
    }));

  info(`Firecrawl extracted ${comps.length} properties`);
  return comps;
}

export { formatNumber, buildRedfinUrl, withTimeout, MAX_COMPS };
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/redfin-scraper.ts
git commit -m "feat: add Firecrawl-based Redfin scraper with structured extract mode"
```

---

### Task 4: Add Playwright Local Fallback

**Files:**
- Modify: `src/lib/redfin-scraper.ts`

Playwright is the fallback for local development when Firecrawl key is not configured. It dynamically imports `playwright` so it doesn't break the Vercel build.

- [ ] **Step 1: Add Playwright scraping function**

Append to `src/lib/redfin-scraper.ts`:

```typescript
/**
 * Local-dev fallback: scrape Redfin with a headless browser via Playwright.
 * Dynamically imports playwright so it doesn't break Vercel builds.
 * Includes bot-detection check for CAPTCHA/403 pages.
 */
export async function scrapeWithPlaywright(
  zip: string,
  log?: (msg: string) => void,
): Promise<RawComp[]> {
  const info = log ?? console.log;

  // Dynamic import — playwright may not be installed in production
  let chromium: typeof import("playwright").chromium;
  try {
    const pw = await import("playwright");
    chromium = pw.chromium;
  } catch {
    throw new Error("Playwright not installed — install with: npm install playwright");
  }

  let browser: import("playwright").Browser | null = null;

  try {
    info("Launching headless Chromium...");
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    });
    const page = await context.newPage();

    const url = buildRedfinUrl(zip);
    info(`Navigating to: ${url}`);
    await page.goto(url, { waitUntil: "networkidle", timeout: 15_000 });

    // Check for bot-blocking
    const title = await page.title();
    const bodyText = await page.textContent("body") ?? "";
    if (
      title.toLowerCase().includes("captcha") ||
      title.toLowerCase().includes("access denied") ||
      bodyText.includes("unusual traffic")
    ) {
      throw new Error("Redfin blocked the request (CAPTCHA/anti-bot detected)");
    }

    info("Extracting property data from search results...");
    const comps = await page.evaluate(() => {
      const results: Array<{
        address: string;
        sold_price: number;
        sold_date: string;
        sqft: number;
        beds: number;
        baths: number;
        lot_sqft: number | null;
        redfin_url: string;
      }> = [];

      const parseNum = (s: string): number => {
        const m = s.replace(/[^0-9.]/g, "");
        return m ? parseFloat(m) : 0;
      };

      const cards = document.querySelectorAll(
        '.HomeCardContainer, [data-rf-test-id="mapHomeCard"], .MapHomeCardReact, [class*="HomeCard"]'
      );

      for (const card of cards) {
        try {
          const addressEl = card.querySelector(
            '[class*="homeAddress"], .homeAddressV2, .link-and-anchor, [data-rf-test-id="abp-homeinfo-homeAddress"]'
          ) as HTMLElement | null;
          const address = addressEl?.textContent?.trim() ?? "";

          const priceEl = card.querySelector(
            '[class*="homecardPrice"], .homecardV2Price, span[class*="Price"], [data-rf-test-id="abp-price"]'
          ) as HTMLElement | null;
          const sold_price = priceEl ? parseNum(priceEl.textContent ?? "") : 0;

          const statsText = (
            card.querySelector('[class*="HomeStats"], [class*="homecard-stats"], .HomeStatsV2') as HTMLElement | null
          )?.textContent ?? "";

          const bedsMatch = statsText.match(/(\d+)\s*(?:bed|bd)/i);
          const bathsMatch = statsText.match(/([\d.]+)\s*(?:bath|ba)/i);
          const sqftMatch = statsText.match(/([\d,]+)\s*(?:sq\s*ft|sqft)/i);

          const beds = bedsMatch ? parseInt(bedsMatch[1]) : 0;
          const baths = bathsMatch ? parseFloat(bathsMatch[1]) : 0;
          const sqft = sqftMatch ? parseNum(sqftMatch[1]) : 0;

          const soldText = (
            card.querySelector('[class*="soldDate"], [class*="homecardStatus"]') as HTMLElement | null
          )?.textContent ?? "";
          let sold_date = "";
          const dateMatch = soldText.match(/(?:sold|closed)\s+(\w+\s+\d{1,2},?\s+\d{4})/i);
          if (dateMatch) {
            const d = new Date(dateMatch[1]);
            if (!isNaN(d.getTime())) sold_date = d.toISOString().split("T")[0];
          }

          const linkEl = card.querySelector('a[href*="/home/"]') as HTMLAnchorElement | null;
          const redfin_url = linkEl
            ? `https://www.redfin.com${linkEl.getAttribute("href")}`
            : "";

          if (address && sold_price > 0 && sqft > 0) {
            results.push({ address, sold_price, sold_date, sqft, beds, baths, lot_sqft: null, redfin_url });
          }
        } catch {
          // Skip malformed cards
        }
      }
      return results;
    });

    info(`Playwright scraped ${comps.length} properties`);
    return comps.slice(0, MAX_COMPS);
  } finally {
    if (browser) await browser.close();
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/redfin-scraper.ts
git commit -m "feat: add Playwright local-dev fallback scraper with bot detection"
```

---

### Task 5: Create Unified `scrapeComps` with Timeout and Fallback Chain

**Files:**
- Modify: `src/lib/redfin-scraper.ts`

- [ ] **Step 1: Add the main `scrapeComps` function**

Add to `src/lib/redfin-scraper.ts`:

```typescript
/**
 * Main entry point: scrape recently sold comps for a zip code.
 * Fallback chain: Firecrawl → Playwright → empty (caller uses Claude knowledge).
 * Overall timeout: 20 seconds for all attempts combined.
 */
export async function scrapeComps(
  zip: string,
  log?: (msg: string) => void,
): Promise<ScrapeResult> {
  const info = log ?? console.log;

  async function tryAll(): Promise<ScrapeResult> {
    // 1. Try Firecrawl (primary — works in production and local)
    if (process.env.FIRECRAWL_API_KEY) {
      try {
        info("Attempting Redfin scrape via Firecrawl (primary)...");
        const comps = await scrapeWithFirecrawl(zip, log);
        if (comps.length > 0) {
          info(`Firecrawl: ${comps.length} comps scraped successfully`);
          return { comps, source: "firecrawl" };
        }
        info("Firecrawl returned 0 results, trying fallback...");
      } catch (err) {
        info(`Firecrawl failed: ${err instanceof Error ? err.message : String(err)}`);
      }
    } else {
      info("FIRECRAWL_API_KEY not set, skipping Firecrawl");
    }

    // 2. Try Playwright (local-dev fallback — won't work on Vercel)
    try {
      info("Attempting Redfin scrape via Playwright (local fallback)...");
      const comps = await scrapeWithPlaywright(zip, log);
      if (comps.length > 0) {
        info(`Playwright: ${comps.length} comps scraped successfully`);
        return { comps, source: "playwright" };
      }
      info("Playwright returned 0 results");
    } catch (err) {
      info(`Playwright failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    // 3. All scrapers failed
    info("All scrapers failed — will fall back to Claude knowledge (unverified)");
    return { comps: [], source: "claude-knowledge" };
  }

  // Wrap entire pipeline in a timeout
  try {
    return await withTimeout(tryAll(), SCRAPE_TIMEOUT, "Scraping pipeline");
  } catch (err) {
    info(`Scraping timed out: ${err instanceof Error ? err.message : String(err)}`);
    return { comps: [], source: "claude-knowledge" };
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/redfin-scraper.ts
git commit -m "feat: add unified scrapeComps with Firecrawl→Playwright fallback and 20s timeout"
```

---

### Task 6: Update CMA Route — Complete Integration

**Files:**
- Modify: `src/app/api/admin/candidate-homes/[id]/comps/route.ts`

This task rewrites the route to integrate scraping. The scraping happens **before** the streaming/non-streaming branch (lines ~323-337 in the original), so there are no `send()` scope issues.

- [ ] **Step 1: Add imports at top of route.ts**

After line 3 (`import type { CompsResult } from "@/lib/types";`), add:

```typescript
import { scrapeComps } from "@/lib/redfin-scraper";
import type { RawComp, ScrapeResult } from "@/lib/types";
```

- [ ] **Step 2: Add zip extraction helper**

After the `extractJSON` function (line ~41), add:

```typescript
/** Extract 5-digit zip code from an address string. */
function extractZip(address: string): string | null {
  const match = address.match(/\b(\d{5})(?:-\d{4})?\b/);
  return match ? match[1] : null;
}
```

- [ ] **Step 3: Add the verified-data prompt builder**

After the existing `buildUserPrompt` function (line ~226), add:

```typescript
function buildVerifiedCompsPrompt(opts: {
  address: string;
  price: string | number;
  subjectBeds: number | string;
  subjectBaths: number | string;
  subjectSqft: number | string;
  subjectLot: number | string;
  subjectYearBuilt: number | string;
  propertyType: string;
  sourceUrl: string | null;
  scrapedComps: RawComp[];
  scrapeSource: string;
}) {
  const {
    address, price, subjectBeds, subjectBaths, subjectSqft, subjectLot,
    subjectYearBuilt, propertyType, sourceUrl, scrapedComps, scrapeSource,
  } = opts;

  const today = new Date().toISOString().split("T")[0];
  const fmt = (n: number) => new Intl.NumberFormat("en-US").format(n);

  const compsTable = scrapedComps
    .map((c, i) =>
      `${i + 1}. ${c.address} | Sold: $${fmt(c.sold_price)} on ${c.sold_date || "unknown"} | ${c.beds}bd/${c.baths}ba | ${fmt(c.sqft)} sqft${c.lot_sqft ? ` | Lot: ${fmt(c.lot_sqft)} sqft` : ""}${c.redfin_url ? ` | ${c.redfin_url}` : ""}`
    )
    .join("\n");

  return `Today's date is ${today}. Use this to calculate recency (months_ago) for each comp.

Perform a CMA for this subject property:

Address: ${address}
Property Type: ${propertyType}
List Price: ${typeof price === "number" ? `$${fmt(price)}` : price}
Square Feet: ${subjectSqft}
Bedrooms: ${subjectBeds}
Bathrooms: ${subjectBaths}
Lot Size: ${typeof subjectLot === "number" ? `${fmt(subjectLot)} sqft` : subjectLot}
Year Built: ${subjectYearBuilt}
${sourceUrl ? `Source URL: ${sourceUrl}` : ""}

=== VERIFIED RECENTLY SOLD COMPS (scraped from Redfin via ${scrapeSource}) ===
The following comps have VERIFIED sold prices from Redfin. Use ONLY these comps for your analysis.
Do NOT invent or add additional comps. These prices are real transaction data.

${compsTable}

Score each comp using the similarity formula with recency adjustment, rank by total_score (recency-adjusted), select the top 8, and produce the CompsResult JSON. Exclude comps older than 12 months entirely. Remember to IGNORE the listing price when computing the price estimate.

For any comp where lot_sqft is not available, use 0 for the lot_sqft field and reduce the lot_size weight to 0, redistributing its 20% weight equally to the other two criteria (house size becomes 60%, bed+bath becomes 40%).

For the distance_miles field, estimate the distance from the subject property based on the addresses. If you cannot determine the distance, use 0.`;
}
```

- [ ] **Step 4: Update the POST handler — non-streaming path**

Replace lines ~323-379 (from `const address = ...` through the non-streaming return). The key change: scraping happens right after extracting property details, before the prompt is built, using `console.log` for the non-streaming path:

```typescript
  const address = home.address || home.title || "Unknown address";
  const price = home.price || home.price_numeric || "Unknown";
  const sourceUrl = home.url || null;

  const subjectBeds = home.beds ?? "Unknown";
  const subjectBaths = home.baths ?? "Unknown";
  const subjectSqft = home.sqft ?? "Unknown";
  const subjectLot = home.lot_sqft ?? "Unknown";
  const subjectYearBuilt = home.year_built ?? "Unknown";
  const propertyType = home.property_type ?? "Single Family";

  // --- Scrape real comp data (before streaming/non-streaming branch) ---
  const zip = extractZip(address);
  let scrapeResult: ScrapeResult = { comps: [], source: "claude-knowledge" };
  const scrapeLog = (msg: string) => console.log(`[Scraper] ${msg}`);

  if (zip) {
    scrapeResult = await scrapeComps(zip, scrapeLog);
  } else {
    console.log("[Scraper] Warning: no zip code found in address, skipping scrape");
  }

  // Build prompt: verified data if available, otherwise Claude knowledge (unverified)
  const userPrompt = scrapeResult.comps.length > 0
    ? buildVerifiedCompsPrompt({
        address, price, subjectBeds, subjectBaths, subjectSqft, subjectLot,
        subjectYearBuilt, propertyType, sourceUrl,
        scrapedComps: scrapeResult.comps,
        scrapeSource: scrapeResult.source,
      })
    : buildUserPrompt({
        address, price, subjectBeds, subjectBaths, subjectSqft, subjectLot,
        subjectYearBuilt, propertyType, sourceUrl,
      });

  // Non-streaming mode
  if (!stream) {
```

The rest of the non-streaming path (Claude API call, JSON parsing, DB save) stays the same.

- [ ] **Step 5: Update the POST handler — streaming path**

Inside the streaming `ReadableStream.start(controller)` block, replace the subject-details logging (lines ~401-406) with logging that also reports scrape results:

```typescript
        send("log", { message: `Subject: ${address}` });
        send("log", { message: `Details: ${subjectBeds} bed / ${subjectBaths} bath / ${subjectSqft} sqft` });
        send("log", { message: `Listed at: ${typeof price === "number" ? `$${price.toLocaleString()}` : price}` });

        if (scrapeResult.comps.length > 0) {
          send("log", { message: `Data source: ${scrapeResult.comps.length} verified comps from ${scrapeResult.source}` });
        } else {
          send("log", { message: "Data source: Claude knowledge (unverified) — scraping unavailable" });
        }

        send("log", { message: "" });
```

The `userPrompt` variable is already built above (before the streaming branch), so the Claude API call uses it directly — no changes needed to the `anthropic.messages.stream(...)` call.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/admin/candidate-homes/[id]/comps/route.ts
git commit -m "feat: integrate Redfin scraper into CMA route with verified-data prompt"
```

---

### Task 7: Add FIRECRAWL_API_KEY to Environment

**Files:**
- Modify: `.env.local`
- Modify: `.env.example`

- [ ] **Step 1: Add FIRECRAWL_API_KEY**

Add to `.env.local`:
```
# Firecrawl API key for Redfin scraping (primary scraper)
FIRECRAWL_API_KEY=your-key-here
```

Add to `.env.example`:
```
FIRECRAWL_API_KEY=
```

- [ ] **Step 2: Commit env example only**

```bash
git add .env.example
git commit -m "chore: add FIRECRAWL_API_KEY to env example"
```

---

### Task 8: End-to-End Smoke Test

- [ ] **Step 1: Start the dev server**

```bash
npm run dev -- -p 3001
```

- [ ] **Step 2: Test the comps page with force refresh**

Navigate to `http://localhost:3001/comps/fbb295a9-42e3-4c25-9566-07ef0b7c122c` and click "Refresh" to trigger a fresh CMA run. Watch the console log for:
- `[Scraper] Attempting Redfin scrape via Firecrawl (primary)...` (if key is set)
- OR `[Scraper] Attempting Redfin scrape via Playwright (local fallback)...`
- `Data source: N verified comps from firecrawl` or `playwright`

- [ ] **Step 3: Verify sold prices match reality**

Check that the comps table shows real sold prices. Specifically verify:
- 1616 Sunnyslope Ave, Belmont, CA 94002 → $2,677,075
- 1520 Ralston Ave, Belmont, CA 94002 → $3,738,108

- [ ] **Step 4: Test fallback chain**

1. Remove `FIRECRAWL_API_KEY` from `.env.local` → should fall back to Playwright
2. If Playwright also fails → should fall back to Claude knowledge with "unverified" log
3. Restore the key after testing

- [ ] **Step 5: Commit any final fixes**

```bash
git add src/lib/redfin-scraper.ts src/app/api/admin/candidate-homes/[id]/comps/route.ts
git commit -m "fix: polish Redfin scraping integration after smoke test"
```
