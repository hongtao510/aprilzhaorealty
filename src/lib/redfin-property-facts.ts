/**
 * Per-property Redfin page scraping for signals not available in the search CSV:
 *  - assigned neighborhood string (e.g., "Mount Carmel")
 *  - elementary school rating (1-10)
 *  - listing description
 *  - inferred renovation tier (0=original/fixer .. 4=new construction)
 *
 * Cached in the `redfin_property_facts` table (production) and on disk (backtest).
 */

export interface PropertyFacts {
  redfin_url: string;
  neighborhood: string | null;
  elementary_school_rating: number | null;
  description: string | null;
  renovation_tier: 0 | 1 | 2 | 3 | 4;
  renovation_keywords: string[];
  fetched_at: string;
}

const FETCH_TIMEOUT_MS = 8_000;

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

/** Ranked tier keywords. Higher tiers win when matched. */
const RENOVATION_KEYWORDS: { tier: 0 | 1 | 2 | 3 | 4; words: string[] }[] = [
  // 4 — new construction
  { tier: 4, words: ["new construction", "newly built", "just completed", "brand new home"] },
  // 3 — heavy renovation
  {
    tier: 3,
    words: [
      "fully renovated",
      "completely remodeled",
      "substantially renovated",
      "extensive renovation",
      "extensively remodeled",
      "down to the studs",
      "gut renovation",
      "new kitchen and bath",
      "high-end finishes",
      "luxury finishes",
    ],
  },
  // 2 — moderate updates
  {
    tier: 2,
    words: [
      "remodeled",
      "renovated",
      "updated kitchen",
      "updated bath",
      "upgraded",
      "modernized",
      "designer",
      "new appliances",
      "engineered hardwood",
      "quartz",
    ],
  },
  // 1 — light updates / move-in ready
  {
    tier: 1,
    words: ["well-maintained", "move-in ready", "updated", "refreshed", "freshly painted"],
  },
  // 0 — original / fixer
  {
    tier: 0,
    words: [
      "fixer",
      "needs work",
      "tlc",
      "as-is",
      "as is",
      "starter home",
      "potential",
      "customize",
      "tear down",
      "tear-down",
      "teardown",
      "build your dream",
      "endless possibilities",
      "diamond in the rough",
    ],
  },
];

/** Known SF Peninsula / Silicon Valley neighborhood names — match against description text. */
const KNOWN_NEIGHBORHOODS = [
  // San Mateo
  "Aragon", "Baywood", "Hillsdale", "Hayward Park", "Sunnybrae", "Beresford",
  "San Mateo Park", "Shoreview", "Bay Meadows",
  // Belmont
  "Belmont Heights", "Belmont Country Club", "Belmont Woods", "Davey Glen",
  "Cipriani Park", "Hallmark",
  // Redwood City
  "Mount Carmel", "Mt. Carmel", "Mt Carmel", "Emerald Hills", "Farm Hill", "Roosevelt",
  "Centennial", "Friendly Acres", "Eagle Hill", "Mount Pleasant", "Stambaugh-Heller",
  "Redwood Shores", "Redwood Oaks",
  // San Carlos
  "White Oaks", "Clearfield Park", "Howard Park", "Beverly Terrace",
  // Burlingame
  "Burlingame Park", "Easton", "Burlingame Hills",
  // Palo Alto / Menlo Park
  "Crescent Park", "Old Palo Alto", "Professorville", "Midtown", "South of Midtown",
  "Allied Arts", "West Menlo Park", "Linfield Oaks",
];

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms),
    ),
  ]);
}

/** Decode common JSON string escapes — Redfin uses `\u002F` etc. */
function decodeJsonString(s: string): string {
  return s
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\")
    .replace(/\s+/g, " ")
    .trim();
}

function extractDescription(html: string): string | null {
  // Redfin embeds: "description":"..."
  const m = html.match(/"description"\s*:\s*"((?:\\.|[^"\\])+)"/);
  if (!m) return null;
  return decodeJsonString(m[1]);
}

function extractElementarySchoolRating(html: string): number | null {
  // The Schools section has repeating blocks like:
  //   <div class="SchoolsListItem__heading ...">{NAME} Elementary School</div>
  //   ...
  //   <div class="SchoolsListItem__schoolRating">{N}/10</div>
  // Take the first item whose name contains "Elementary" or "Elem".
  const itemRe =
    /SchoolsListItem__heading[^>]*>([^<]+)<[\s\S]*?SchoolsListItem__schoolRating[^>]*>(\d{1,2})\s*\/\s*10/g;
  let match: RegExpExecArray | null;
  while ((match = itemRe.exec(html)) !== null) {
    const name = match[1];
    const rating = parseInt(match[2], 10);
    if (/elementar|elem\.?\s*school|k-?[58]/i.test(name) && Number.isFinite(rating) && rating >= 1 && rating <= 10) {
      return rating;
    }
  }
  // Fallback: first rating period
  const first = html.match(/SchoolsListItem__schoolRating[^>]*>(\d{1,2})\s*\/\s*10/);
  if (first) {
    const n = parseInt(first[1], 10);
    if (n >= 1 && n <= 10) return n;
  }
  return null;
}

function extractNeighborhood(html: string, description: string | null): string | null {
  // Only the description text is reliable enough — HTML mentions like "Hillsdale Shopping Center"
  // produce false positives for nearby pockets that share a word with a shopping district.
  if (!description) return null;
  // Require a neighborhood-context cue within ~40 chars of the match.
  const cues = ["neighborhood", "neighborhoods", "area", "pocket", "district", "in the", "located in", "heart of"];
  for (const name of KNOWN_NEIGHBORHOODS) {
    const escaped = name.replace(/\./g, "\\.").replace(/ /g, "[\\s-]");
    const windowRe = new RegExp(
      `\\b${escaped}\\b[^.]{0,40}(?:${cues.join("|")})|(?:${cues.join("|")})[^.]{0,40}\\b${escaped}\\b`,
      "i",
    );
    if (windowRe.test(description)) {
      return name.replace(/^Mt\.?\s+/, "Mount ");
    }
  }
  return null;
}

function inferRenovationTier(description: string | null): { tier: 0 | 1 | 2 | 3 | 4; matched: string[] } {
  if (!description) return { tier: 1, matched: [] };
  const text = description.toLowerCase();
  const matched: string[] = [];
  let bestTier: number | null = null;
  for (const group of RENOVATION_KEYWORDS) {
    for (const w of group.words) {
      if (text.includes(w.toLowerCase())) {
        matched.push(w);
        if (bestTier === null || group.tier > bestTier) {
          // Higher tier wins UNLESS it's tier 0 (fixer) — fixer keywords override moderate
          // when both appear, because "renovated kitchen, otherwise needs work" should still flag.
          // Simpler: max wins, except keep tier 0 if explicit fixer keyword found.
          bestTier = group.tier;
        }
      }
    }
  }
  if (bestTier === null) return { tier: 1, matched: [] };
  // If we matched any tier-0 (fixer) keywords, force tier 0 — those are dispositive.
  const hasFixer = RENOVATION_KEYWORDS.find((g) => g.tier === 0)?.words.some((w) =>
    text.includes(w.toLowerCase()),
  );
  if (hasFixer) return { tier: 0, matched };
  return { tier: bestTier as 0 | 1 | 2 | 3 | 4, matched };
}

export async function fetchPropertyFacts(
  redfin_url: string,
  log?: (msg: string) => void,
): Promise<PropertyFacts | null> {
  if (!redfin_url) return null;
  const info = log ?? (() => {});
  try {
    const refererZip = redfin_url.match(/\b(\d{5})\b/)?.[1] ?? "";
    const res = await withTimeout(
      fetch(redfin_url, {
        headers: {
          ...HEADERS,
          ...(refererZip ? { Referer: `https://www.redfin.com/zipcode/${refererZip}` } : {}),
        },
      }),
      FETCH_TIMEOUT_MS,
      `Redfin page fetch ${redfin_url}`,
    );
    if (!res.ok) {
      info(`Property page returned ${res.status} for ${redfin_url}`);
      return null;
    }
    const html = await res.text();
    const description = extractDescription(html);
    const elementary = extractElementarySchoolRating(html);
    const neighborhood = extractNeighborhood(html, description);
    const reno = inferRenovationTier(description);
    return {
      redfin_url,
      neighborhood,
      elementary_school_rating: elementary,
      description: description ? description.slice(0, 2000) : null,
      renovation_tier: reno.tier,
      renovation_keywords: reno.matched,
      fetched_at: new Date().toISOString(),
    };
  } catch (err) {
    info(`Failed to fetch property facts: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

/** Fetch facts for many urls in parallel with bounded concurrency. */
export async function fetchPropertyFactsBatch(
  urls: string[],
  concurrency = 4,
  log?: (msg: string) => void,
): Promise<Map<string, PropertyFacts>> {
  const out = new Map<string, PropertyFacts>();
  let cursor = 0;
  async function worker() {
    while (cursor < urls.length) {
      const i = cursor++;
      const url = urls[i];
      const facts = await fetchPropertyFacts(url, log);
      if (facts) out.set(url, facts);
    }
  }
  const workers = Array.from({ length: Math.min(concurrency, urls.length) }, () => worker());
  await Promise.all(workers);
  return out;
}
