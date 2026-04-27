import {
  haversineMiles,
  localMedianPpsf,
  scoreComps,
} from "../src/lib/comps/similarity";
import { computeEstimate } from "../src/lib/comps/pricing";
import type { RawComp } from "../src/lib/types";
import assert from "node:assert/strict";
import * as fs from "node:fs";

let failures = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) console.log(`  ok  ${name}`);
  else {
    console.log(`  FAIL ${name}`, detail ?? "");
    failures += 1;
  }
}

// --- Haversine ---
{
  const sf = { lat: 37.7749, lng: -122.4194 };
  const oak = { lat: 37.8044, lng: -122.2712 };
  const d = haversineMiles(sf, oak);
  check("haversine SF→Oakland ~8mi", Math.abs(d - 8) < 1, d);
  check("haversine identical = 0", haversineMiles(sf, sf) === 0);
}

// --- Local median ppsf ---
{
  const comps: RawComp[] = [
    { address: "a", sold_price: 1_000_000, sold_date: "2026-01-01", sqft: 1000, beds: 3, baths: 2, lot_sqft: 5000, redfin_url: "", latitude: 37.5, longitude: -122.3 }, // 1000/sf
    { address: "b", sold_price: 2_000_000, sold_date: "2026-01-01", sqft: 1000, beds: 3, baths: 2, lot_sqft: 5000, redfin_url: "", latitude: 37.5001, longitude: -122.3 }, // 2000/sf
    { address: "c", sold_price: 1_500_000, sold_date: "2026-01-01", sqft: 1000, beds: 3, baths: 2, lot_sqft: 5000, redfin_url: "", latitude: 37.5002, longitude: -122.3 }, // 1500/sf
    { address: "d-far", sold_price: 5_000_000, sold_date: "2026-01-01", sqft: 1000, beds: 3, baths: 2, lot_sqft: 5000, redfin_url: "", latitude: 38.0, longitude: -122.0 }, // far
  ];
  const m = localMedianPpsf(comps, 37.5, -122.3, 0.4, 3);
  check("localMedianPpsf median = 1500", m === 1500, m);
  const tooFew = localMedianPpsf(comps, 37.5, -122.3, 0.4, 5);
  check("localMedianPpsf returns null when below minComps", tooFew === null);
}

// --- Recency: exp decay, hard cutoff ---
{
  const subject = {
    sqft: 1000,
    beds: 3,
    baths: 2,
    lot_sqft: 5000,
    latitude: 37.5,
    longitude: -122.3,
    property_type: "Single Family",
  };
  const today = new Date("2026-04-26");
  const mk = (date: string): RawComp => ({
    address: date,
    sold_price: 1_000_000,
    sold_date: date,
    sqft: 1000,
    beds: 3,
    baths: 2,
    lot_sqft: 5000,
    redfin_url: "",
    latitude: 37.5,
    longitude: -122.3,
    property_type: "Single Family",
  });
  const comps = [
    mk("2026-04-26"), // 0mo
    mk("2025-10-26"), // 6mo
    mk("2025-04-26"), // 12mo
    mk("2024-10-26"), // 18mo (boundary)
    mk("2024-04-26"), // 24mo (excluded)
  ];
  const scored = scoreComps(subject, comps, today);
  check("recency: 5 comps in window (24mo excluded)", scored.length === 4, scored.length);
  const r0 = scored.find((c) => c.address === "2026-04-26");
  const r6 = scored.find((c) => c.address === "2025-10-26");
  const r12 = scored.find((c) => c.address === "2025-04-26");
  check("recency at 0mo ≈ 1.0", r0 !== undefined && Math.abs(r0.recency - 1) < 0.01);
  check("recency at 6mo ≈ 0.61", r6 !== undefined && Math.abs(r6.recency - Math.exp(-0.5)) < 0.01, r6?.recency);
  check("recency at 12mo ≈ 0.37", r12 !== undefined && Math.abs(r12.recency - Math.exp(-1)) < 0.01, r12?.recency);
}

// --- Property-type filter ---
{
  const subject = {
    sqft: 1000, beds: 3, baths: 2, lot_sqft: 5000,
    latitude: 37.5, longitude: -122.3, property_type: "Single Family",
  };
  // Need >= MIN_POOL_FOR_HEALTHY_PICK SFRs so the thin-pool fallback that drops
  // enforcePropertyType doesn't trigger.
  const sfrs: RawComp[] = Array.from({ length: 10 }).map((_, i) => ({
    address: `sfr-${i}`,
    sold_price: 1_000_000 + i * 1000,
    sold_date: "2026-04-01",
    sqft: 1000, beds: 3, baths: 2, lot_sqft: 5000,
    redfin_url: `sfr-${i}`,
    latitude: 37.5 + i * 0.0001,
    longitude: -122.3,
    property_type: "Single Family",
  }));
  const condo: RawComp = { address: "condo", sold_price: 1_500_000, sold_date: "2026-04-01", sqft: 1000, beds: 3, baths: 2, lot_sqft: 5000, redfin_url: "condo", latitude: 37.5, longitude: -122.3, property_type: "Condo/Co-op" };
  const scored = scoreComps(subject, [...sfrs, condo], new Date("2026-04-26"));
  check("property-type filter excludes condos when pool is healthy", !scored.some((c) => c.address === "condo"), scored.map((c) => c.address));
}

// --- Distance score decay ---
{
  const subject = {
    sqft: 1000, beds: 3, baths: 2, lot_sqft: 5000,
    latitude: 37.5, longitude: -122.3, property_type: null,
  };
  const closeC: RawComp = { address: "close", sold_price: 1_000_000, sold_date: "2026-04-01", sqft: 1000, beds: 3, baths: 2, lot_sqft: 5000, redfin_url: "", latitude: 37.5, longitude: -122.3, property_type: null };
  // ~1.0mi away — within default maxDistanceMiles=1.5 but with a meaningful penalty
  const midC: RawComp = { address: "mid", sold_price: 1_000_000, sold_date: "2026-04-01", sqft: 1000, beds: 3, baths: 2, lot_sqft: 5000, redfin_url: "", latitude: 37.5145, longitude: -122.3, property_type: null };
  // ~6.9mi away — should be hard-excluded
  const farC: RawComp = { address: "far", sold_price: 1_000_000, sold_date: "2026-04-01", sqft: 1000, beds: 3, baths: 2, lot_sqft: 5000, redfin_url: "", latitude: 37.6, longitude: -122.3, property_type: null };
  const scored = scoreComps(subject, [closeC, midC, farC], new Date("2026-04-26"));
  const close = scored.find((c) => c.address === "close")!;
  const mid = scored.find((c) => c.address === "mid")!;
  const far = scored.find((c) => c.address === "far");
  check("close distance_score = 1.0", Math.abs(close.distance_score - 1) < 0.01, close.distance_score);
  check("mid distance_score < 0.4", mid !== undefined && mid.distance_score < 0.4, mid?.distance_score);
  check("far excluded by maxDistanceMiles", far === undefined);
  check("close ranks higher than mid", close.total_score > mid.total_score);
}

// --- 275 41st Ave with 1A scoring ---
{
  console.log("\n=== 275 41st Ave, San Mateo (1A scoring) ===");
  const subject = {
    sqft: 1907,
    beds: 4,
    baths: 3,
    lot_sqft: 5000,
    latitude: 37.5395,
    longitude: -122.2998,
    property_type: "Single Family Residential",
  };
  const csv = fs.readFileSync("/tmp/sm_94403_solds.csv", "utf-8");
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
    .map((l) => parseLine(l))
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

  console.log(`  raw comps after filter: ${raw.length}`);

  const scored = scoreComps(subject, raw, new Date("2026-04-26"));
  const top8 = scored.slice(0, 8);
  console.log("  Top 8 (1A):");
  top8.forEach((c) => {
    console.log(
      `    ${c.total_score.toFixed(3)} | ${c.sold_date} | ${c.address.slice(0, 38).padEnd(38)} $${(c.sold_price / 1e6).toFixed(2)}M | ${c.sqft}sf | $${Math.round(c.price_per_sqft)}/sf | ${c.distance_miles.toFixed(2)}mi | tier ${c.tier_score.toFixed(2)} | sim ${c.similarity.toFixed(2)} rec ${c.recency.toFixed(2)}`,
    );
  });

  const est = computeEstimate({
    subjectSqft: subject.sqft,
    comps: top8.map((c) => ({ sold_price: c.sold_price, sqft: c.sqft, similarity_score: c.total_score })),
    marketTemperature: "warm",
  });

  console.log(`  Comp-based: $${est.comp_based.toLocaleString()}`);
  console.log(`  Most likely: $${est.range.most_likely[0].toLocaleString()}–$${est.range.most_likely[1].toLocaleString()}`);
  console.log(`  Actual sold: $2,700,800 → ${((est.comp_based - 2_700_800) / 2_700_800 * 100).toFixed(1)}% gap`);

  check("275 41st Ave: 1A estimate within 10% of actual", Math.abs(est.comp_based - 2_700_800) / 2_700_800 < 0.10, est.comp_based);
}

// --- 1081 Judson St with 1A scoring ---
{
  console.log("\n=== 1081 Judson St, Belmont (1A scoring) ===");
  const subject = {
    sqft: 1210,
    beds: 3,
    baths: 1,
    lot_sqft: 5001,
    latitude: 37.5172, // approx Judson St
    longitude: -122.2890,
    property_type: "Single Family Residential",
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
    .map((l) => parseLine(l))
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

  console.log(`  raw comps after filter: ${raw.length}`);

  const scored = scoreComps(subject, raw, new Date("2026-04-26"));
  const top8 = scored.slice(0, 8);
  console.log("  Top 8 (1A):");
  top8.forEach((c) => {
    console.log(
      `    ${c.total_score.toFixed(3)} | ${c.sold_date} | ${c.address.slice(0, 38).padEnd(38)} $${(c.sold_price / 1e6).toFixed(2)}M | ${c.sqft}sf | $${Math.round(c.price_per_sqft)}/sf | ${c.distance_miles.toFixed(2)}mi | tier ${c.tier_score.toFixed(2)} | sim ${c.similarity.toFixed(2)} rec ${c.recency.toFixed(2)}`,
    );
  });

  const est = computeEstimate({
    subjectSqft: subject.sqft,
    comps: top8.map((c) => ({ sold_price: c.sold_price, sqft: c.sqft, similarity_score: c.total_score })),
    marketTemperature: "warm",
  });

  console.log(`  Comp-based: $${est.comp_based.toLocaleString()}`);
  console.log(`  Most likely: $${est.range.most_likely[0].toLocaleString()}–$${est.range.most_likely[1].toLocaleString()}`);
  console.log(`  Listed: $1,288,000 | Redfin range: $1,465,000–$2,183,000`);
  check("1081 Judson: 1A estimate inside Redfin range", est.comp_based >= 1_465_000 && est.comp_based <= 2_183_000, est.comp_based);
}

console.log(`\n${failures === 0 ? "ALL PASS" : `${failures} FAIL`}`);
assert.equal(failures, 0);
