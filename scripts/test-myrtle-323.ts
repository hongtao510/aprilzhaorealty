import { scoreComps } from "../src/lib/comps/similarity";
import { computeEstimate } from "../src/lib/comps/pricing";
import type { RawComp } from "../src/lib/types";
import * as fs from "node:fs";

const subject = {
  sqft: 1820,
  beds: 3,
  baths: 2,
  lot_sqft: 5277,
  latitude: 37.4775529,
  longitude: -122.2433935,
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
  // Exclude subject from its own comp pool (backtest leak guard)
  .filter((c) => !/^323\s+Myrtle\s+St\b/i.test(c.address));

console.log("\n=== 323 Myrtle St, Redwood City 94062 (Mount Carmel) ===");
console.log("Subject: 3bd/2ba, 1,820 sqft, lot 5,277 sqft, built 1956");
console.log("Sold: $2,615,000 on Mar 20, 2026 (~$1,437/sqft)\n");
console.log(`Raw comps after filter: ${raw.length}`);

const scored = scoreComps(subject, raw, new Date("2026-04-26"));
const top10 = scored.slice(0, 10);

console.log(`\nTop 10 (1A pipeline) — sent to Claude:\n`);
console.log("  Score | Date       | Address                                  | Price   | Sqft | $/sf  | Dist  | Tier | Sim  | Rec");
console.log("  ------+------------+------------------------------------------+---------+------+-------+-------+------+------+-----");
top10.forEach((c) =>
  console.log(
    `  ${c.total_score.toFixed(3)} | ${c.sold_date} | ${c.address.slice(0, 40).padEnd(40)} | $${(c.sold_price / 1e6).toFixed(2)}M  | ${String(c.sqft).padStart(4)} | $${String(Math.round(c.price_per_sqft)).padStart(5)} | ${c.distance_miles.toFixed(2)}mi | ${c.tier_score.toFixed(2)} | ${c.similarity.toFixed(2)} | ${c.recency.toFixed(2)}`,
  ),
);

const top8 = top10.slice(0, 8);
const est = computeEstimate({
  subjectSqft: subject.sqft,
  comps: top8.map((c) => ({ sold_price: c.sold_price, sqft: c.sqft, similarity_score: c.total_score })),
  marketTemperature: "warm",
});

console.log(`\n=== DETERMINISTIC ESTIMATE (top 8 by total_score) ===`);
console.log(`  Weighted $/sqft:   $${est.weighted_price_per_sqft.toLocaleString()}`);
console.log(`  Comp-based:        $${est.comp_based.toLocaleString()}`);
console.log(`  Trend-adjusted:    $${est.trend_adjusted.toLocaleString()}  (${est.market_temperature}, ${est.trend_adjustment_pct}%)`);
console.log(`  Most likely (50%): $${est.range.most_likely[0].toLocaleString()} – $${est.range.most_likely[1].toLocaleString()}`);
console.log(`  Likely:            $${est.range.likely[0].toLocaleString()} – $${est.range.likely[1].toLocaleString()}`);
console.log(`  Possible:          $${est.range.possible[0].toLocaleString()} – $${est.range.possible[1].toLocaleString()}`);

const actual = 2_615_000;
const gap = ((est.comp_based - actual) / actual) * 100;
console.log(`\n  Actual sold:       $${actual.toLocaleString()}`);
console.log(`  Gap:               ${gap.toFixed(1)}%`);
console.log(`  Inside most-likely band? ${actual >= est.range.most_likely[0] && actual <= est.range.most_likely[1]}`);
console.log(`  Inside likely band?      ${actual >= est.range.likely[0] && actual <= est.range.likely[1]}`);
