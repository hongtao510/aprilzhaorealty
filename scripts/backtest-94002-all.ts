import { scoreComps } from "../src/lib/comps/similarity";
import { computeEstimate } from "../src/lib/comps/pricing";
import type { RawComp } from "../src/lib/types";
import * as fs from "node:fs";

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

const all: RawComp[] = lines
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
  }))
  .filter((c) => c.sold_price > 0 && c.sqft > 0 && c.sold_date && c.lot_sqft && Number.isFinite(c.latitude) && Number.isFinite(c.longitude));

console.log(`Loaded ${all.length} solds with full data\n`);

interface Result { addr: string; actual: number; mean: number; median: number; hybrid: number; mean5?: number; hybrid5?: number }
const results: Result[] = [];

for (const subj of all) {
  const asOf = new Date(subj.sold_date);
  const pool = all.filter(
    (c) =>
      !c.address.toLowerCase().startsWith(subj.address.toLowerCase().split(",")[0].toLowerCase()) &&
      new Date(c.sold_date) < asOf,
  );
  if (pool.length < 8) continue;
  const scored = scoreComps(
    {
      sqft: subj.sqft,
      beds: subj.beds,
      baths: subj.baths,
      lot_sqft: subj.lot_sqft,
      latitude: subj.latitude!,
      longitude: subj.longitude!,
      property_type: subj.property_type ?? null,
      year_built: subj.year_built ?? null,
    },
    pool,
    asOf,
  );
  const top8 = scored.slice(0, 8);
  if (top8.length < 5) continue;
  const top5 = scored.slice(0, 5);

  const r: Result & { mean5: number; hybrid5: number } = { addr: subj.address.split(",")[0], actual: subj.sold_price, mean: 0, median: 0, hybrid: 0, mean5: 0, hybrid5: 0 };
  for (const strategy of ["mean", "median", "hybrid"] as const) {
    const est = computeEstimate({
      subjectSqft: subj.sqft,
      subjectLotSqft: subj.lot_sqft,
      comps: top8.map((c) => ({ sold_price: c.sold_price, sqft: c.sqft, similarity_score: c.total_score, lot_sqft: c.lot_sqft })),
      marketTemperature: "warm",
      strategy,
    });
    r[strategy] = est.comp_based;
  }
  // Top-5 variants: more selective comp set
  const est5mean = computeEstimate({
    subjectSqft: subj.sqft, subjectLotSqft: subj.lot_sqft,
    comps: top5.map((c) => ({ sold_price: c.sold_price, sqft: c.sqft, similarity_score: c.total_score, lot_sqft: c.lot_sqft })),
    marketTemperature: "warm", strategy: "mean",
  });
  r.mean5 = est5mean.comp_based;
  const est5h = computeEstimate({
    subjectSqft: subj.sqft, subjectLotSqft: subj.lot_sqft,
    comps: top5.map((c) => ({ sold_price: c.sold_price, sqft: c.sqft, similarity_score: c.total_score, lot_sqft: c.lot_sqft })),
    marketTemperature: "warm", strategy: "hybrid",
  });
  r.hybrid5 = est5h.comp_based;
  results.push(r);
}

console.log(`Backtested ${results.length} subjects\n`);

const summary = (label: string, key: "mean" | "median" | "hybrid") => {
  const errs = results.map((r) => (r[key] - r.actual) / r.actual * 100);
  const abs = errs.map(Math.abs);
  const meanErr = errs.reduce((s, e) => s + e, 0) / errs.length;
  const mape = abs.reduce((s, e) => s + e, 0) / abs.length;
  const median = [...abs].sort((a, b) => a - b)[Math.floor(abs.length / 2)];
  const within10 = abs.filter((e) => e < 10).length;
  const within15 = abs.filter((e) => e < 15).length;
  const within20 = abs.filter((e) => e < 20).length;
  console.log(`${label.padEnd(7)}: bias ${meanErr >= 0 ? "+" : ""}${meanErr.toFixed(1)}% | MAPE ${mape.toFixed(1)}% | median |err| ${median.toFixed(1)}% | <10% ${within10}/${results.length} | <15% ${within15}/${results.length} | <20% ${within20}/${results.length}`);
};

summary("mean", "mean");
summary("median", "median");
summary("hybrid", "hybrid");

const summary5 = (label: string, key: "mean5" | "hybrid5") => {
  const errs = results.map((r) => ((r[key] ?? r.mean) - r.actual) / r.actual * 100);
  const abs = errs.map(Math.abs);
  const meanErr = errs.reduce((s, e) => s + e, 0) / errs.length;
  const mape = abs.reduce((s, e) => s + e, 0) / abs.length;
  const median = [...abs].sort((a, b) => a - b)[Math.floor(abs.length / 2)];
  const within10 = abs.filter((e) => e < 10).length;
  const within15 = abs.filter((e) => e < 15).length;
  const within20 = abs.filter((e) => e < 20).length;
  console.log(`${label.padEnd(7)}: bias ${meanErr >= 0 ? "+" : ""}${meanErr.toFixed(1)}% | MAPE ${mape.toFixed(1)}% | median |err| ${median.toFixed(1)}% | <10% ${within10}/${results.length} | <15% ${within15}/${results.length} | <20% ${within20}/${results.length}`);
};
summary5("mean5", "mean5");
summary5("hybrid5", "hybrid5");

console.log("\nTop-K sweep (mean strategy):");
for (const k of [3, 4, 5, 6, 7, 8]) {
  const errs: number[] = [];
  for (const subj of all) {
    const asOf = new Date(subj.sold_date);
    const pool = all.filter(
      (c) =>
        !c.address.toLowerCase().startsWith(subj.address.toLowerCase().split(",")[0].toLowerCase()) &&
        new Date(c.sold_date) < asOf,
    );
    if (pool.length < k + 3) continue;
    const scored = scoreComps(
      { sqft: subj.sqft, beds: subj.beds, baths: subj.baths, lot_sqft: subj.lot_sqft, latitude: subj.latitude!, longitude: subj.longitude!, property_type: subj.property_type ?? null, year_built: subj.year_built ?? null },
      pool, asOf,
    );
    const topK = scored.slice(0, k);
    if (topK.length < k) continue;
    const est = computeEstimate({
      subjectSqft: subj.sqft, subjectLotSqft: subj.lot_sqft,
      comps: topK.map((c) => ({ sold_price: c.sold_price, sqft: c.sqft, similarity_score: c.total_score, lot_sqft: c.lot_sqft })),
      marketTemperature: "warm", strategy: "mean",
    });
    errs.push(((est.comp_based - subj.sold_price) / subj.sold_price) * 100);
  }
  const abs = errs.map(Math.abs);
  const mape = abs.reduce((s, e) => s + e, 0) / abs.length;
  const median = [...abs].sort((a, b) => a - b)[Math.floor(abs.length / 2)];
  const w10 = abs.filter((e) => e < 10).length;
  console.log(`  k=${k}: n=${errs.length} | MAPE ${mape.toFixed(1)}% | median |err| ${median.toFixed(1)}% | <10% ${w10}/${errs.length}`);
}

console.log("\nWorst 5 (hybrid):");
[...results].sort((a, b) => Math.abs(b.hybrid - b.actual) / b.actual - Math.abs(a.hybrid - a.actual) / a.actual).slice(0, 5).forEach((r) =>
  console.log(`  ${r.addr.padEnd(28)} actual $${r.actual.toLocaleString()} | est $${r.hybrid.toLocaleString()} | ${(((r.hybrid - r.actual) / r.actual) * 100).toFixed(1)}%`),
);

console.log("\nBest 5 (hybrid):");
[...results].sort((a, b) => Math.abs(a.hybrid - a.actual) / a.actual - Math.abs(b.hybrid - b.actual) / b.actual).slice(0, 5).forEach((r) =>
  console.log(`  ${r.addr.padEnd(28)} actual $${r.actual.toLocaleString()} | est $${r.hybrid.toLocaleString()} | ${(((r.hybrid - r.actual) / r.actual) * 100).toFixed(1)}%`),
);
