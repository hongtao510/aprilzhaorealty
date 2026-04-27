import { localMedianPpsf, scoreComps } from "../src/lib/comps/similarity";
import { computeEstimate } from "../src/lib/comps/pricing";
import type { RawComp } from "../src/lib/types";
import * as fs from "node:fs";

const subject = {
  sqft: 1820, beds: 3, baths: 2, lot_sqft: 5277,
  latitude: 37.4775529, longitude: -122.2433935,
  property_type: "Single Family Residential",
};

const csv = fs.readFileSync("/tmp/rwc_94062_solds.csv", "utf-8");
const lines = csv.split("\n").filter((l) => l.startsWith("PAST SALE"));
const parseLine = (line: string) => {
  const cols: string[] = [];
  let cur = "", q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    else if (ch === "," && !q) { cols.push(cur); cur = ""; }
    else cur += ch;
  }
  cols.push(cur);
  return cols;
};
const parseDate = (s: string) => {
  if (!s) return "";
  const d = new Date(s.replace(/-/g, " "));
  return isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
};

const raw: RawComp[] = lines
  .map(parseLine)
  .filter((c) => c.length >= 27)
  .map((c) => ({
    address: `${c[3]}, ${c[4]}, ${c[5]} ${c[6]}`,
    sold_price: parseFloat((c[7] || "0").replace(/[^0-9.]/g, "")),
    sold_date: parseDate(c[1]),
    sqft: parseFloat((c[11] || "0").replace(/[^0-9.]/g, "")),
    beds: parseInt(c[8] || "0"),
    baths: parseFloat(c[9] || "0"),
    lot_sqft: parseFloat((c[12] || "0").replace(/[^0-9.]/g, "")) || null,
    redfin_url: c[20] || "",
    latitude: parseFloat(c[25]),
    longitude: parseFloat(c[26]),
    property_type: (c[2] || "").trim(),
  }))
  .filter((c) => c.sold_price > 0 && c.sqft > 0 && c.sold_date)
  .filter((c) => !/^323\s+Myrtle\s+St\b/i.test(c.address));

console.log(`Total raw comps in pool: ${raw.length}`);

// Tier sensitivity sweep
console.log("\nSubject tier-pool size by radius:");
for (const r of [0.3, 0.4, 0.5, 0.7, 1.0, 1.5]) {
  let count = 0;
  for (const c of raw) {
    if (c.latitude == null || c.longitude == null) continue;
    const dLat = (subject.latitude - c.latitude) * 69;
    const dLng = (subject.longitude - c.longitude) * 69 * Math.cos((subject.latitude * Math.PI) / 180);
    const d = Math.sqrt(dLat * dLat + dLng * dLng);
    if (d <= r) count += 1;
  }
  const m = localMedianPpsf(raw, subject.latitude, subject.longitude, r, 2);
  console.log(`  ${r}mi: ${count} comps, median $/sqft: ${m ? "$" + Math.round(m) : "null (below minComps)"}`);
}

// Try a few configs
const configs = [
  { name: "default (0.4mi, min3)", tierRadiusMiles: 0.4, tierMinComps: 3 },
  { name: "wider (0.7mi, min3)",   tierRadiusMiles: 0.7, tierMinComps: 3 },
  { name: "wide+laxer (1.0mi, min3)", tierRadiusMiles: 1.0, tierMinComps: 3 },
];

for (const cfg of configs) {
  console.log(`\n=== Config: ${cfg.name} ===`);
  const scored = scoreComps(subject, raw, new Date("2026-04-26"), {
    weights: { size: 0.30, bedbath: 0.15, lot: 0.10, location: 0.25, era: 0.08, school: 0.05, renovation: 0.07 },
    locationSubWeights: { distance: 0.35, tier: 0.20, neighborhood: 0.20, city: 0.25 },
    recencyHalfLifeMonths: 12,
    maxRecencyMonths: 18,
    distanceHalfLifeMiles: 0.75,
    tierRadiusMiles: cfg.tierRadiusMiles,
    tierMinComps: cfg.tierMinComps,
    bedbathSpread: 3,
    eraSpread: 30,
    schoolSpread: 5,
    enforcePropertyType: true,
    enforceSameCity: false,
    maxDistanceMiles: 1.5,
  });
  const top10 = scored.slice(0, 10);
  console.log("  Top 10 with tier scores:");
  top10.forEach((c) =>
    console.log(
      `    ${c.total_score.toFixed(3)} | ${c.address.slice(0, 40).padEnd(40)} | $${(c.sold_price / 1e6).toFixed(2)}M | $${Math.round(c.price_per_sqft)}/sf | ${c.distance_miles.toFixed(2)}mi | tier ${c.tier_score.toFixed(2)}`,
    ),
  );

  const top8 = top10.slice(0, 8);
  const est = computeEstimate({
    subjectSqft: subject.sqft,
    comps: top8.map((c) => ({ sold_price: c.sold_price, sqft: c.sqft, similarity_score: c.total_score })),
    marketTemperature: "warm",
  });
  const actual = 2_615_000;
  const gap = ((est.comp_based - actual) / actual) * 100;
  console.log(`  Comp-based: $${est.comp_based.toLocaleString()} (gap ${gap.toFixed(1)}%)`);
}
