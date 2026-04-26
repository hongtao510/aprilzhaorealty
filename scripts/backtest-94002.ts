import { scoreComps } from "../src/lib/comps/similarity";
import { computeEstimate } from "../src/lib/comps/pricing";
import type { RawComp } from "../src/lib/types";
import * as fs from "node:fs";

type Strategy = "mean" | "median" | "hybrid";

interface Subject {
  address: string;
  sqft: number;
  beds: number;
  baths: number;
  lot_sqft: number;
  latitude: number;
  longitude: number;
  property_type: string;
  actualSoldPrice: number;
  asOf: Date; // pretend "today" — should be the day BEFORE the subject sold
}

const subjects: Subject[] = [
  {
    address: "2404 Cipriani Blvd",
    sqft: 1280, beds: 3, baths: 1, lot_sqft: 5565,
    latitude: 37.5167112, longitude: -122.3040607,
    property_type: "Single Family Residential",
    actualSoldPrice: 2_150_000,
    asOf: new Date("2026-03-19"),
  },
  {
    address: "1709 Hillman Ave",
    sqft: 1630, beds: 3, baths: 2.5, lot_sqft: 7728,
    latitude: 37.5250478, longitude: -122.291683,
    property_type: "Single Family Residential",
    actualSoldPrice: 2_050_000,
    asOf: new Date("2026-04-19"),
  },
  {
    address: "513 Chesterton Ave",
    sqft: 1010, beds: 3, baths: 1, lot_sqft: 5000,
    latitude: 37.5279786, longitude: -122.2773541,
    property_type: "Single Family Residential",
    actualSoldPrice: 1_840_000,
    asOf: new Date("2026-03-12"),
  },
];

const csv = fs.readFileSync("/tmp/belmont_94002_solds.csv", "utf-8");
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

const allRaw: RawComp[] = lines
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
  .filter((c) => c.sold_price > 0 && c.sqft > 0 && c.sold_date);

console.log("=".repeat(80));
console.log("94002 Backtest — strategy comparison (mean / median / hybrid)");
console.log("=".repeat(80));

interface PerSubject {
  subject: string;
  actual: number;
  perStrategy: Record<Strategy, { est: number; gap: number; inMostLikely: boolean; inLikely: boolean }>;
}

const all: PerSubject[] = [];

for (const subj of subjects) {
  const pool = allRaw
    .filter((c) => !c.address.toLowerCase().startsWith(subj.address.toLowerCase().split(",")[0].toLowerCase()))
    .filter((c) => new Date(c.sold_date) < subj.asOf);

  console.log(`\n--- ${subj.address} (sold $${subj.actualSoldPrice.toLocaleString()}, ${subj.sqft}sf, lot ${subj.lot_sqft}) ---`);

  const scored = scoreComps(subj, pool, subj.asOf);
  const top8 = scored.slice(0, 8);
  if (top8.length === 0) { console.log("  WARN: no comps"); continue; }

  const distRange = top8.map((c) => c.distance_miles);
  const ppsfRange = top8.map((c) => c.price_per_sqft);
  console.log(`  Pool ${pool.length} → top 8: distance ${Math.min(...distRange).toFixed(2)}–${Math.max(...distRange).toFixed(2)}mi, $/sqft $${Math.round(Math.min(...ppsfRange))}–$${Math.round(Math.max(...ppsfRange))}`);
  top8.forEach((c) => console.log(`    ${c.total_score.toFixed(3)} | ${c.address.slice(0, 50).padEnd(50)} $${(c.sold_price / 1e6).toFixed(2)}M | ${c.sqft}sf | $${Math.round(c.price_per_sqft)}/sf | ${c.distance_miles.toFixed(2)}mi`));

  const perStrategy: PerSubject["perStrategy"] = {} as PerSubject["perStrategy"];
  for (const strategy of ["mean", "median", "hybrid"] as Strategy[]) {
    const est = computeEstimate({
      subjectSqft: subj.sqft,
      subjectLotSqft: subj.lot_sqft,
      comps: top8.map((c) => ({ sold_price: c.sold_price, sqft: c.sqft, similarity_score: c.total_score, lot_sqft: c.lot_sqft })),
      marketTemperature: "warm",
      strategy,
    });
    const gap = ((est.comp_based - subj.actualSoldPrice) / subj.actualSoldPrice) * 100;
    perStrategy[strategy] = {
      est: est.comp_based,
      gap,
      inMostLikely: subj.actualSoldPrice >= est.range.most_likely[0] && subj.actualSoldPrice <= est.range.most_likely[1],
      inLikely: subj.actualSoldPrice >= est.range.likely[0] && subj.actualSoldPrice <= est.range.likely[1],
    };
    console.log(`  ${strategy.padEnd(7)}: $${est.comp_based.toLocaleString().padStart(10)} | $${est.weighted_price_per_sqft}/sf | most_likely $${est.range.most_likely[0].toLocaleString()}–$${est.range.most_likely[1].toLocaleString()} | gap ${gap >= 0 ? "+" : ""}${gap.toFixed(1)}%`);
  }
  all.push({ subject: subj.address, actual: subj.actualSoldPrice, perStrategy });
}

console.log("\n" + "=".repeat(80));
console.log("SUMMARY");
console.log("=".repeat(80));
for (const strategy of ["mean", "median", "hybrid"] as Strategy[]) {
  const gaps = all.map((r) => Math.abs(r.perStrategy[strategy].gap));
  const mape = gaps.reduce((s, g) => s + g, 0) / gaps.length;
  const mostHit = all.filter((r) => r.perStrategy[strategy].inMostLikely).length;
  const likelyHit = all.filter((r) => r.perStrategy[strategy].inLikely).length;
  console.log(`${strategy.padEnd(7)}: MAPE ${mape.toFixed(1)}% | most_likely ${mostHit}/${all.length} | likely ${likelyHit}/${all.length}`);
}
