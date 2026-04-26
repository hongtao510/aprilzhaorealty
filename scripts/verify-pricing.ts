import { computeEstimate } from "../src/lib/comps/pricing";
import assert from "node:assert/strict";

let failures = 0;
function check(name: string, cond: boolean, detail?: unknown) {
  if (cond) {
    console.log(`  ok  ${name}`);
  } else {
    console.log(`  FAIL ${name}`, detail ?? "");
    failures += 1;
  }
}

// --- 1. Single comp at exact sqft, no trend ---
{
  const est = computeEstimate({
    subjectSqft: 2000,
    comps: [{ sold_price: 2_000_000, sqft: 2000, similarity_score: 1 }],
    marketTemperature: "warm",
  });
  check("single comp ppsf == sold_price/sqft", est.weighted_price_per_sqft === 1000, est);
  check("single comp comp_based rounded", est.comp_based === 2_000_000, est);
  check("warm trend = 0%", est.trend_adjustment_pct === 0);
  check("trend_adjusted == comp_based when warm", est.trend_adjusted === est.comp_based);
  // Even with std=0, percentage floor (5%) widens the band.
  const halfWidth = (est.range.most_likely[1] - est.range.most_likely[0]) / 2;
  check("std=0 → most_likely uses percentage floor (~5% of estimate)", Math.abs(halfWidth - 100_000) <= 25_000, halfWidth);
}

// --- 2. Two comps with weights ---
{
  const est = computeEstimate({
    subjectSqft: 1000,
    comps: [
      { sold_price: 1_000_000, sqft: 1000, similarity_score: 1.0 }, // $1000/sf
      { sold_price: 1_500_000, sqft: 1000, similarity_score: 0.5 }, // $1500/sf
    ],
    marketTemperature: "warm",
  });
  // Weighted ppsf = (1000*1.0 + 1500*0.5)/1.5 = 1750/1.5 = 1166.67
  check("weighted ppsf ~ 1167", Math.abs(est.weighted_price_per_sqft - 1167) <= 1, est);
  check("comp_based ~ 1.167M rounded to 1k", est.comp_based === 1_167_000, est);
  check("std > 0 → most_likely is a band", est.range.most_likely[1] > est.range.most_likely[0]);
}

// --- 3. Hot market trend +3.5% ---
{
  const est = computeEstimate({
    subjectSqft: 2000,
    comps: [{ sold_price: 2_000_000, sqft: 2000, similarity_score: 1 }],
    marketTemperature: "hot",
  });
  check("hot trend = 3.5%", est.trend_adjustment_pct === 3.5);
  check("trend_adjusted = comp_based * 1.035 rounded", est.trend_adjusted === 2_070_000, est);
}

// --- 4. Empty comps → zeros ---
{
  const est = computeEstimate({ subjectSqft: 2000, comps: [], marketTemperature: "warm" });
  check("empty comps → comp_based = 0", est.comp_based === 0);
  check("empty comps → range zeros", est.range.most_likely[0] === 0 && est.range.most_likely[1] === 0);
}

// --- 5. Zero-score comp filtered out ---
{
  const est = computeEstimate({
    subjectSqft: 1000,
    comps: [
      { sold_price: 1_000_000, sqft: 1000, similarity_score: 0 },
      { sold_price: 1_200_000, sqft: 1000, similarity_score: 0.8 },
    ],
    marketTemperature: "warm",
  });
  check("zero-score comp ignored → ppsf = 1200", est.weighted_price_per_sqft === 1200, est);
}

// --- 6. Half-width cap at 100k ---
{
  // Wide spread: prices vary from 1M to 5M (subject 2000 sqft → comp-implied 1M-5M)
  const est = computeEstimate({
    subjectSqft: 2000,
    comps: [
      { sold_price: 1_000_000, sqft: 2000, similarity_score: 1 }, // 500/sf → 1M
      { sold_price: 5_000_000, sqft: 2000, similarity_score: 1 }, // 2500/sf → 5M
    ],
    marketTemperature: "warm",
  });
  // Weighted mean = 3M. std = sqrt(((1M-3M)^2 + (5M-3M)^2)/2) = 2M.
  // half_width capped at 200k.
  const halfWidth =
    (est.range.most_likely[1] - est.range.most_likely[0]) / 2;
  check("half-width capped at 200k", halfWidth <= 200_000, halfWidth);
}

// --- 7. Real-world case: 275 41st Ave, San Mateo (sold $2.7M Apr 6 2026) ---
// Top 8 comps from current scoring (output of the run we did earlier in conversation).
{
  const top8 = [
    { sold_price: 2_401_888, sqft: 2020, similarity_score: 0.852 }, // 3936 Regan Dr
    { sold_price: 2_720_000, sqft: 1908, similarity_score: 0.727 }, // 866 Parrott Dr
    { sold_price: 3_100_000, sqft: 1850, similarity_score: 0.625 }, // 2027 New Brunswick
    { sold_price: 3_100_000, sqft: 2012, similarity_score: 0.612 }, // 1801 Notre Dame
    { sold_price: 2_450_000, sqft: 2100, similarity_score: 0.561 }, // 3400 Douglas Ct
    { sold_price: 2_350_000, sqft: 1850, similarity_score: 0.559 }, // 2045 Mezes
    { sold_price: 1_650_000, sqft: 1680, similarity_score: 0.546 }, // 2736 Foster St
    { sold_price: 2_438_000, sqft: 1721, similarity_score: 0.535 }, // 2710 Isabelle
  ];
  const est = computeEstimate({
    subjectSqft: 1907,
    comps: top8,
    marketTemperature: "warm",
  });
  console.log("\n  275 41st Ave estimate:");
  console.log(`    weighted $/sqft: $${est.weighted_price_per_sqft}`);
  console.log(`    comp_based: $${est.comp_based.toLocaleString()}`);
  console.log(`    most_likely: $${est.range.most_likely[0].toLocaleString()}–$${est.range.most_likely[1].toLocaleString()}`);
  console.log(`    actual sold: $2,700,800 (${((2_700_800 - est.comp_based) / 2_700_800 * 100).toFixed(1)}% gap)`);

  check("275 41st Ave: estimate within 10% of sold", Math.abs(est.comp_based - 2_700_800) / 2_700_800 < 0.10, est);
  check("275 41st Ave: weighted ppsf in 1100–1500 range", est.weighted_price_per_sqft >= 1100 && est.weighted_price_per_sqft <= 1500, est.weighted_price_per_sqft);
}

console.log(`\n${failures === 0 ? "ALL PASS" : `${failures} FAIL`}`);
assert.equal(failures, 0);
