// Research-only Redfin browser scraper using Puppeteer.
// Redfin's Terms of Service may restrict automated access.
// Use responsibly with low volume for personal real estate research.

import puppeteer, { type Browser, type Page } from "puppeteer-core";

// --- Types ---

export interface RedfinPropertyDetails {
  url: string;
  address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  price: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  lotSqft: number | null;
  yearBuilt: number | null;
  propertyType: string | null;
  description: string | null;
  latitude: number | null;
  longitude: number | null;
  imageUrls: string[];
  hoaDues: number | null;
  daysOnMarket: number | null;
  pricePerSqft: number | null;
  status: string | null;
  listingAgent: string | null;
}

export interface RedfinSearchResult {
  url: string;
  address: string;
  price: number | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  imageUrl: string | null;
}

export interface RedfinComparable {
  url: string;
  address: string;
  soldPrice: number | null;
  soldDate: string | null;
  beds: number | null;
  baths: number | null;
  sqft: number | null;
  pricePerSqft: number | null;
}

// --- Internal helpers ---

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function getChromiumPath(): Promise<{
  executablePath: string;
  args: string[];
  headless: boolean | "shell";
}> {
  // On Vercel / serverless: use @sparticuz/chromium
  if (process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.VERCEL) {
    const chromium = (await import("@sparticuz/chromium")).default;
    return {
      executablePath: await chromium.executablePath(),
      args: chromium.args,
      headless: chromium.headless as boolean | "shell",
    };
  }

  // Local dev: use CHROME_PATH env or common system paths
  const chromePath =
    process.env.CHROME_PATH ||
    "/usr/bin/google-chrome" ||
    "/usr/bin/chromium-browser";

  return {
    executablePath: chromePath,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
    headless: "shell",
  };
}

async function launchBrowser(): Promise<Browser> {
  const { executablePath, args, headless } = await getChromiumPath();
  return puppeteer.launch({
    executablePath,
    args,
    headless,
    defaultViewport: { width: 1920, height: 1080 },
  });
}

async function createPage(browser: Browser): Promise<Page> {
  const page = await browser.newPage();
  await page.setUserAgent(USER_AGENT);
  await page.setExtraHTTPHeaders({ "Accept-Language": "en-US,en;q=0.9" });

  // Block heavy resources to speed up loading
  await page.setRequestInterception(true);
  page.on("request", (req) => {
    const type = req.resourceType();
    if (["image", "font", "media"].includes(type)) {
      req.abort();
    } else {
      req.continue();
    }
  });

  return page;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseNumber(text: string | null | undefined): number | null {
  if (!text) return null;
  const cleaned = text.replace(/[^0-9.]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

// --- Exported functions ---

/**
 * Scrape property details from a Redfin property URL.
 */
export async function scrapePropertyDetails(
  url: string
): Promise<RedfinPropertyDetails> {
  const browser = await launchBrowser();
  try {
    const page = await createPage(browser);
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
    await delay(2000); // Let dynamic content settle

    const details = await page.evaluate(() => {
      const result: Record<string, unknown> = {};

      // Try JSON-LD structured data first (most reliable)
      const jsonLdScripts = document.querySelectorAll(
        'script[type="application/ld+json"]'
      );
      for (const script of jsonLdScripts) {
        try {
          const data = JSON.parse(script.textContent || "");
          if (
            data["@type"] === "RealEstateListing" ||
            data["@type"] === "SingleFamilyResidence" ||
            data["@type"] === "Product"
          ) {
            result.jsonLd = data;
          }
        } catch {
          // ignore parse errors
        }
      }

      // OG meta tags as fallback
      const ogTitle =
        document
          .querySelector('meta[property="og:title"]')
          ?.getAttribute("content") || null;
      const ogDescription =
        document
          .querySelector('meta[property="og:description"]')
          ?.getAttribute("content") || null;
      const ogImage =
        document
          .querySelector('meta[property="og:image"]')
          ?.getAttribute("content") || null;

      result.ogTitle = ogTitle;
      result.ogDescription = ogDescription;
      result.ogImage = ogImage;

      // Page title
      result.pageTitle = document.title;

      // Extract key stats from the page
      // Redfin uses various selectors - try multiple approaches
      const statsElements = document.querySelectorAll(
        ".HomeMainStats .stat-block, .home-main-stats-variant .stat-block, .HomeInfoV2 .stat-block"
      );
      const stats: Record<string, string> = {};
      statsElements.forEach((el) => {
        const value = el.querySelector(".statsValue")?.textContent?.trim();
        const label = el.querySelector(".statsLabel")?.textContent?.trim();
        if (value && label) stats[label.toLowerCase()] = value;
      });
      result.stats = stats;

      // Price from the header
      const priceEl = document.querySelector(
        '.statsValue [data-rf-test-id="abp-price"], .price-section .statsValue, .price'
      );
      result.price = priceEl?.textContent?.trim() || null;

      // If no price from statsValue, try broader selectors
      if (!result.price) {
        const priceMeta = document.querySelector(
          'meta[property="product:price:amount"]'
        );
        result.price = priceMeta?.getAttribute("content") || null;
      }

      // Address
      const addressEl = document.querySelector(
        '.street-address, [data-rf-test-id="abp-streetLine"], .homeAddress .street-address'
      );
      const cityStateEl = document.querySelector(
        '.dp-subtext, [data-rf-test-id="abp-cityStateZip"], .homeAddress .dp-subtext'
      );
      result.address = addressEl?.textContent?.trim() || null;
      result.cityStateZip = cityStateEl?.textContent?.trim() || null;

      // Key details table
      const keyDetails: Record<string, string> = {};
      const keyDetailEls = document.querySelectorAll(
        ".keyDetail, .HomeInfoV2 .keyDetail, .amenity-group .entryItemContent"
      );
      keyDetailEls.forEach((el) => {
        const text = el.textContent?.trim();
        if (text) {
          const parts = text.split(/:\s*/);
          if (parts.length === 2) {
            keyDetails[parts[0].toLowerCase()] = parts[1];
          }
        }
      });
      result.keyDetails = keyDetails;

      // Status (Active, Pending, Sold, etc.)
      const statusEl = document.querySelector(
        '.ListingStatusBannerSection, .dp-status-text, [data-rf-test-id="listingStatus"]'
      );
      result.status = statusEl?.textContent?.trim() || null;

      // Description
      const descEl = document.querySelector(
        ".remarksSection, .ListingRemarks, #TextContent"
      );
      result.description = descEl?.textContent?.trim() || null;

      // Images
      const imageEls = document.querySelectorAll(
        ".PhotosView img, .gallery img, .media-viewer img"
      );
      result.imageUrls = Array.from(imageEls)
        .map((img) => (img as HTMLImageElement).src)
        .filter((src) => src && !src.includes("data:"));

      // Listing agent
      const agentEl = document.querySelector(
        ".agent-basic-details .agent-name, .listing-agent-name"
      );
      result.listingAgent = agentEl?.textContent?.trim() || null;

      // Days on market
      const domEl = document.querySelector(
        '.timeOnRedfin, [data-rf-test-id="timeOnRedfin"]'
      );
      result.daysOnMarket = domEl?.textContent?.trim() || null;

      // Full page text for regex fallback extraction
      result.bodyText = document.body?.innerText?.substring(0, 5000) || "";

      return result;
    });

    // Parse and structure the results
    const jsonLd = details.jsonLd as Record<string, unknown> | undefined;
    const stats = (details.stats as Record<string, string>) || {};
    const keyDetails = (details.keyDetails as Record<string, string>) || {};
    const bodyText = (details.bodyText as string) || "";

    // Parse city/state/zip from cityStateZip string
    let city: string | null = null;
    let state: string | null = null;
    let zip: string | null = null;
    const csz = details.cityStateZip as string | null;
    if (csz) {
      const cszMatch = csz.match(/^(.+),\s*([A-Z]{2})\s+(\d{5})/);
      if (cszMatch) {
        city = cszMatch[1].trim();
        state = cszMatch[2];
        zip = cszMatch[3];
      }
    }

    // Parse beds/baths/sqft from stats or body text
    let beds = parseNumber(stats["beds"] || stats["bed"]);
    let baths = parseNumber(stats["baths"] || stats["bath"]);
    let sqft = parseNumber(stats["sq ft"] || stats["sqft"]);

    // Fallback: regex from body text
    if (!beds) {
      const bedsMatch = bodyText.match(/(\d+)\s*(?:beds?|bedrooms?|Beds?|BR)/i);
      if (bedsMatch) beds = parseInt(bedsMatch[1]);
    }
    if (!baths) {
      const bathsMatch = bodyText.match(
        /(\d+(?:\.\d+)?)\s*(?:baths?|bathrooms?|Baths?|BA)/i
      );
      if (bathsMatch) baths = parseFloat(bathsMatch[1]);
    }
    if (!sqft) {
      const sqftMatch = bodyText.match(
        /([\d,]+)\s*(?:sq\s*ft|square\s*feet|Sq\.?\s*Ft)/i
      );
      if (sqftMatch) sqft = parseNumber(sqftMatch[1]);
    }

    // Parse price
    let price = parseNumber(details.price as string);
    if (!price && jsonLd) {
      const offers = jsonLd.offers as Record<string, unknown> | undefined;
      if (offers?.price) price = parseNumber(String(offers.price));
    }

    // Parse lot size
    let lotSqft = parseNumber(keyDetails["lot size"] || keyDetails["lot"]);
    if (!lotSqft) {
      const lotMatch = bodyText.match(
        /([\d,.]+)\s*(?:acres?|sq\s*ft\s*lot|lot\s*sq\s*ft)/i
      );
      if (lotMatch) {
        const val = parseNumber(lotMatch[1]);
        if (lotMatch[0].toLowerCase().includes("acre") && val) {
          lotSqft = Math.round(val * 43560);
        } else {
          lotSqft = val;
        }
      }
    }

    // Parse year built
    let yearBuilt = parseNumber(keyDetails["year built"] || keyDetails["built"]);
    if (!yearBuilt) {
      const ybMatch = bodyText.match(/(?:built|year\s*built)\s*(?:in\s*)?(\d{4})/i);
      if (ybMatch) yearBuilt = parseInt(ybMatch[1]);
    }

    // Latitude/longitude from JSON-LD
    let latitude: number | null = null;
    let longitude: number | null = null;
    if (jsonLd) {
      const geo = jsonLd.geo as Record<string, unknown> | undefined;
      if (geo) {
        latitude = (geo.latitude as number) || null;
        longitude = (geo.longitude as number) || null;
      }
    }

    return {
      url,
      address: (details.address as string) || null,
      city,
      state,
      zip,
      price,
      beds,
      baths,
      sqft,
      lotSqft,
      yearBuilt,
      propertyType:
        keyDetails["property type"] || keyDetails["style"] || null,
      description: (details.description as string) || null,
      latitude,
      longitude,
      imageUrls: (details.imageUrls as string[]) || [],
      hoaDues: parseNumber(keyDetails["hoa dues"]),
      daysOnMarket: parseNumber(details.daysOnMarket as string),
      pricePerSqft: price && sqft ? Math.round(price / sqft) : null,
      status: (details.status as string) || null,
      listingAgent: (details.listingAgent as string) || null,
    };
  } finally {
    await browser.close();
  }
}

/**
 * Search Redfin by address and return matching results.
 */
export async function searchByAddress(
  address: string
): Promise<RedfinSearchResult[]> {
  const browser = await launchBrowser();
  try {
    const page = await createPage(browser);
    const searchUrl = `https://www.redfin.com/search?q=${encodeURIComponent(address)}`;
    await page.goto(searchUrl, { waitUntil: "networkidle2", timeout: 30000 });
    await delay(2000);

    // Check if we were redirected to a property page (exact match)
    const currentUrl = page.url();
    if (
      currentUrl.includes("/home/") ||
      currentUrl.match(/\/[A-Z]{2}\/[^/]+\/[^/]+\//)
    ) {
      // Exact match — extract basic info from the property page
      const result = await page.evaluate(() => {
        const address =
          document.querySelector(".street-address")?.textContent?.trim() ||
          document.title.split("|")[0]?.trim() ||
          "";
        const priceEl = document.querySelector(
          '.statsValue [data-rf-test-id="abp-price"], .price-section .statsValue, .price'
        );
        const price = priceEl?.textContent?.trim() || null;
        const ogImage =
          document
            .querySelector('meta[property="og:image"]')
            ?.getAttribute("content") || null;
        return { address, price, ogImage };
      });

      return [
        {
          url: currentUrl,
          address: result.address,
          price: parseNumber(result.price),
          beds: null,
          baths: null,
          sqft: null,
          imageUrl: result.ogImage,
        },
      ];
    }

    // Multiple results — extract search result cards
    const results = await page.evaluate(() => {
      const cards = document.querySelectorAll(
        ".HomeCardContainer, .MapHomeCard, [data-rf-test-name='mapHomeCard']"
      );
      return Array.from(cards)
        .slice(0, 10)
        .map((card) => {
          const link = card.querySelector("a[href]");
          const href = link?.getAttribute("href") || "";
          const address =
            card.querySelector(".homeAddressV2, .link-and-anchor")
              ?.textContent?.trim() || "";
          const price =
            card.querySelector(".homecardV2Price, .homecardV2Price span")
              ?.textContent?.trim() || null;
          const statsText =
            card.querySelector(".HomeStatsV2, .stats")?.textContent || "";
          const img = card.querySelector("img");
          const imageUrl = img?.src || null;

          return {
            url: href.startsWith("http")
              ? href
              : `https://www.redfin.com${href}`,
            address,
            price,
            statsText,
            imageUrl,
          };
        });
    });

    return results.map((r) => {
      let beds: number | null = null;
      let baths: number | null = null;
      let sqft: number | null = null;

      const bedsMatch = r.statsText.match(/(\d+)\s*(?:bed|bd)/i);
      const bathsMatch = r.statsText.match(/(\d+(?:\.\d+)?)\s*(?:bath|ba)/i);
      const sqftMatch = r.statsText.match(/([\d,]+)\s*(?:sq\s*ft|sqft)/i);

      if (bedsMatch) beds = parseInt(bedsMatch[1]);
      if (bathsMatch) baths = parseFloat(bathsMatch[1]);
      if (sqftMatch) sqft = parseNumber(sqftMatch[1]);

      return {
        url: r.url,
        address: r.address,
        price: parseNumber(r.price),
        beds,
        baths,
        sqft,
        imageUrl: r.imageUrl,
      };
    });
  } finally {
    await browser.close();
  }
}

/**
 * Scrape comparable/similar homes from a Redfin property page.
 */
export async function scrapeComparables(
  url: string
): Promise<RedfinComparable[]> {
  const browser = await launchBrowser();
  try {
    const page = await createPage(browser);
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
    await delay(2000);

    // Scroll down to load the comparable homes section
    await page.evaluate(() => {
      window.scrollBy(0, 3000);
    });
    await delay(2000);
    await page.evaluate(() => {
      window.scrollBy(0, 3000);
    });
    await delay(2000);

    const comps = await page.evaluate(() => {
      // Look for the "Similar Homes" or "Comparable Homes" section
      const sections = document.querySelectorAll(
        ".SimilarHomes .HomeCardContainer, .NearbyComparableHomes .HomeCardContainer, .ComparableHomes .HomeCardContainer, .similarHomes .HomeCardContainer"
      );

      if (sections.length === 0) {
        // Try a broader search for nearby/similar cards
        const altCards = document.querySelectorAll(
          '.bottomContent .HomeCardContainer, [data-rf-test-name="comp-card"]'
        );
        if (altCards.length > 0) {
          return Array.from(altCards)
            .slice(0, 15)
            .map((card) => {
              const link = card.querySelector("a[href]");
              const href = link?.getAttribute("href") || "";
              const address =
                card.querySelector(".homeAddressV2, .link-and-anchor")
                  ?.textContent?.trim() || "";
              const price =
                card.querySelector(".homecardV2Price")?.textContent?.trim() ||
                null;
              const statsText =
                card.querySelector(".HomeStatsV2, .stats")?.textContent || "";
              return { href, address, price, statsText };
            });
        }
        return [];
      }

      return Array.from(sections)
        .slice(0, 15)
        .map((card) => {
          const link = card.querySelector("a[href]");
          const href = link?.getAttribute("href") || "";
          const address =
            card.querySelector(".homeAddressV2, .link-and-anchor")
              ?.textContent?.trim() || "";
          const price =
            card.querySelector(".homecardV2Price")?.textContent?.trim() || null;
          const statsText =
            card.querySelector(".HomeStatsV2, .stats")?.textContent || "";
          return { href, address, price, statsText };
        });
    });

    return comps.map((c) => {
      const priceVal = parseNumber(c.price);
      let beds: number | null = null;
      let baths: number | null = null;
      let sqft: number | null = null;

      const bedsMatch = c.statsText.match(/(\d+)\s*(?:bed|bd)/i);
      const bathsMatch = c.statsText.match(/(\d+(?:\.\d+)?)\s*(?:bath|ba)/i);
      const sqftMatch = c.statsText.match(/([\d,]+)\s*(?:sq\s*ft|sqft)/i);

      if (bedsMatch) beds = parseInt(bedsMatch[1]);
      if (bathsMatch) baths = parseFloat(bathsMatch[1]);
      if (sqftMatch) sqft = parseNumber(sqftMatch[1]);

      // Try to detect sold status from price text
      const isSold = c.price?.toLowerCase().includes("sold") || false;
      const soldDateMatch = c.statsText.match(
        /(?:sold|closed)\s*(?:on\s*)?(\w+\s+\d{1,2},?\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{4})/i
      );

      return {
        url: c.href.startsWith("http")
          ? c.href
          : `https://www.redfin.com${c.href}`,
        address: c.address,
        soldPrice: priceVal,
        soldDate: soldDateMatch ? soldDateMatch[1] : isSold ? "Unknown" : null,
        beds,
        baths,
        sqft,
        pricePerSqft: priceVal && sqft ? Math.round(priceVal / sqft) : null,
      };
    });
  } finally {
    await browser.close();
  }
}
