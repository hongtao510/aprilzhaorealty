/**
 * Demonstrate the same-city filter on a Belmont subject.
 * Subject: 917 Anita Ave, Belmont 94002 (placeholder coords ≈ Belmont center).
 * Confirms 2080 Arroyo Dr (San Carlos) drops out, and that the surviving comps
 * are in Belmont (or its adjacent-allowlisted cities).
 */
import { scoreComps, DEFAULT_CONFIG } from "../src/lib/comps/similarity";
import { computeEstimate } from "../src/lib/comps/pricing";
import type { RawComp } from "../src/lib/types";
import * as fs from "node:fs";

const subject = {
  sqft: 1700,
  beds: 3,
  baths: 2,
  lot_sqft: 6000,
  latitude: 37.5213,
  longitude: -122.293,
  property_type: "Single Family Residential",
  year_built: 1955,
  city: "Belmont",
};

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
    year_built: parseInt(c[13] || "") || null,
    redfin_url: c[20] || "",
    latitude: parseFloat(c[25]),
    longitude: parseFloat(c[26]),
    property_type: (c[2] || "").trim(),
    city: (c[4] || "").trim(),
  }))
  .filter((c) => c.sold_price > 0 && c.sqft > 0 && c.sold_date);

const cityCounts = new Map<string, number>();
raw.forEach((c) => cityCounts.set(c.city ?? "(unknown)", (cityCounts.get(c.city ?? "(unknown)") ?? 0) + 1));
console.log("Pool city distribution:");
[...cityCounts.entries()].sort((a, b) => b[1] - a[1]).forEach(([c, n]) => console.log(`  ${c}: ${n}`));

console.log("\n=== WITH same-city filter (default) ===");
const scoredOn = scoreComps(subject, raw, new Date("2026-04-26"));
const top10On = scoredOn.slice(0, 10);
top10On.forEach((c) =>
  console.log(`  ${c.total_score.toFixed(3)} | ${c.address.slice(0, 56).padEnd(56)} | ${c.city ?? "?"} | $${(c.sold_price / 1e6).toFixed(2)}M`),
);

console.log("\n=== WITHOUT same-city filter ===");
const scoredOff = scoreComps(subject, raw, new Date("2026-04-26"), { ...DEFAULT_CONFIG, enforceSameCity: false });
const top10Off = scoredOff.slice(0, 10);
top10Off.forEach((c) =>
  console.log(`  ${c.total_score.toFixed(3)} | ${c.address.slice(0, 56).padEnd(56)} | ${c.city ?? "?"} | $${(c.sold_price / 1e6).toFixed(2)}M`),
);

const arroyoOn = top10On.find((c) => /2080 Arroyo Dr/i.test(c.address));
const arroyoOff = top10Off.find((c) => /2080 Arroyo Dr/i.test(c.address));
console.log("\n2080 Arroyo Dr in top 10:");
console.log("  with filter:", arroyoOn ? "YES (BAD)" : "no — excluded as expected");
console.log("  without filter:", arroyoOff ? "yes" : "no");

console.log("\nEstimate (top-4 mean, with filter):");
const top4 = top10On.slice(0, 4);
const est = computeEstimate({
  subjectSqft: subject.sqft,
  subjectLotSqft: subject.lot_sqft,
  comps: top4.map((c) => ({ sold_price: c.sold_price, sqft: c.sqft, similarity_score: c.total_score, lot_sqft: c.lot_sqft })),
  marketTemperature: "warm",
  strategy: "mean",
});
console.log(`  $${est.comp_based.toLocaleString()}  ($${est.weighted_price_per_sqft}/sf)`);
console.log(`  most likely: $${est.range.most_likely[0].toLocaleString()}–$${est.range.most_likely[1].toLocaleString()}`);
