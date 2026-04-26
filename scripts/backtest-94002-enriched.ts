/**
 * 94002 backtest with full 1A + 1C + 1D + 2D pipeline.
 *  - Pre-fetches each comp's Redfin page for neighborhood/school/renovation
 *  - Caches facts to /tmp/redfin-facts-cache.json across runs
 *  - Computes data-driven monthly trend from the comp pool
 *  - Time-adjusts each comp's sold_price to "as if sold today"
 */
import { scoreComps } from "../src/lib/comps/similarity";
import { computeEstimate } from "../src/lib/comps/pricing";
import { computeTrendFromComps, timeAdjustPrice } from "../src/lib/comps/trend";
import { fetchPropertyFactsBatch, type PropertyFacts } from "../src/lib/redfin-property-facts";
import type { RawComp } from "../src/lib/types";
import * as fs from "node:fs";

const CACHE_PATH = "/tmp/redfin-facts-cache.json";

const csv = fs.readFileSync("/tmp/belmont_94002_solds.csv", "utf-8");
const lines = csv.split("\n").filter((l) => l.startsWith("PAST SALE"));
const parseLine = (line: string) => {
  const cols: string[] = [];
  let cur = "";
  let q = false;
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

console.log(`Loaded ${all.length} solds with full data`);

(async () => {
  // Load disk cache
  let cache: Record<string, PropertyFacts> = {};
  try { cache = JSON.parse(fs.readFileSync(CACHE_PATH, "utf-8")); } catch { /* fresh */ }

  // Identify URLs needing fetch
  const urls = all.map((c) => c.redfin_url).filter((u) => !!u);
  const missing = urls.filter((u) => !cache[u]);
  console.log(`Property facts: ${urls.length - missing.length} cached / ${missing.length} to fetch`);

  if (missing.length > 0) {
    const fetched = await fetchPropertyFactsBatch(missing, 4, (m) => console.log("  [facts]", m));
    for (const [url, facts] of fetched) cache[url] = facts;
    fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 2));
    console.log(`Persisted cache (${Object.keys(cache).length} entries)`);
  }

  // Enrich raw comps with facts
  const enriched: RawComp[] = all.map((c) => {
    const f = cache[c.redfin_url];
    return f
      ? {
          ...c,
          neighborhood: f.neighborhood,
          elementary_school_rating: f.elementary_school_rating,
          renovation_tier: f.renovation_tier,
        }
      : c;
  });

  // Diagnostic: distribution of facts
  const withHood = enriched.filter((c) => c.neighborhood).length;
  const withSchool = enriched.filter((c) => c.elementary_school_rating != null).length;
  const renoTiers = new Map<number, number>();
  enriched.forEach((c) => {
    if (c.renovation_tier != null) renoTiers.set(c.renovation_tier, (renoTiers.get(c.renovation_tier) ?? 0) + 1);
  });
  console.log(`Enrichment: ${withHood}/${enriched.length} have neighborhood, ${withSchool}/${enriched.length} have school rating`);
  console.log(`Renovation tier histogram: ${[...renoTiers.entries()].sort().map(([t, n]) => `${t}:${n}`).join(" ")}`);

  // Backtest
  interface Result { addr: string; actual: number; estTimeAdj: number; estPlain: number; trend: number }
  const results: Result[] = [];

  for (const subj of enriched) {
    const asOf = new Date(subj.sold_date);
    const pool = enriched.filter(
      (c) =>
        !c.address.toLowerCase().startsWith(subj.address.toLowerCase().split(",")[0].toLowerCase()) &&
        new Date(c.sold_date) < asOf,
    );
    if (pool.length < 8) continue;

    // 2D — compute trend from pool
    const trend = computeTrendFromComps(pool, asOf, 12);

    // Time-adjust each comp's sold_price
    const timeAdjustedPool = pool.map((c) => ({
      ...c,
      sold_price: timeAdjustPrice(c.sold_price, c.sold_date, asOf, trend.monthly_drift_pct),
    }));

    const subjectGeo = {
      sqft: subj.sqft,
      beds: subj.beds,
      baths: subj.baths,
      lot_sqft: subj.lot_sqft,
      latitude: subj.latitude!,
      longitude: subj.longitude!,
      property_type: subj.property_type ?? null,
      year_built: subj.year_built ?? null,
      neighborhood: subj.neighborhood ?? null,
      elementary_school_rating: subj.elementary_school_rating ?? null,
      renovation_tier: subj.renovation_tier ?? null,
    };

    // Score against time-adjusted pool
    const scored = scoreComps(subjectGeo, timeAdjustedPool, asOf);
    const top4 = scored.slice(0, 4);
    if (top4.length < 4) continue;

    const estTimeAdj = computeEstimate({
      subjectSqft: subj.sqft,
      subjectLotSqft: subj.lot_sqft,
      comps: top4.map((c) => ({ sold_price: c.sold_price, sqft: c.sqft, similarity_score: c.total_score, lot_sqft: c.lot_sqft })),
      marketTemperature: trend.temperature,
      strategy: "mean",
    });

    // Reference: same scoring but no time adjustment
    const scoredPlain = scoreComps(subjectGeo, pool, asOf);
    const top4Plain = scoredPlain.slice(0, 4);
    const estPlain = computeEstimate({
      subjectSqft: subj.sqft,
      subjectLotSqft: subj.lot_sqft,
      comps: top4Plain.map((c) => ({ sold_price: c.sold_price, sqft: c.sqft, similarity_score: c.total_score, lot_sqft: c.lot_sqft })),
      marketTemperature: "warm",
      strategy: "mean",
    });

    results.push({
      addr: subj.address.split(",")[0],
      actual: subj.sold_price,
      estTimeAdj: estTimeAdj.comp_based,
      estPlain: estPlain.comp_based,
      trend: trend.monthly_drift_pct,
    });
  }

  console.log(`\nBacktested ${results.length} subjects`);

  const summary = (label: string, key: "estTimeAdj" | "estPlain") => {
    const errs = results.map((r) => ((r[key] - r.actual) / r.actual) * 100);
    const abs = errs.map(Math.abs);
    const meanErr = errs.reduce((s, e) => s + e, 0) / errs.length;
    const mape = abs.reduce((s, e) => s + e, 0) / abs.length;
    const median = [...abs].sort((a, b) => a - b)[Math.floor(abs.length / 2)];
    const w10 = abs.filter((e) => e < 10).length;
    const w15 = abs.filter((e) => e < 15).length;
    const w20 = abs.filter((e) => e < 20).length;
    console.log(`${label.padEnd(20)}: bias ${meanErr >= 0 ? "+" : ""}${meanErr.toFixed(1)}% | MAPE ${mape.toFixed(1)}% | median |err| ${median.toFixed(1)}% | <10% ${w10}/${results.length} | <15% ${w15}/${results.length} | <20% ${w20}/${results.length}`);
  };

  summary("plain (no trend)", "estPlain");
  summary("with 2D trend", "estTimeAdj");

  console.log("\nWorst 5 (with 2D trend):");
  [...results].sort((a, b) => Math.abs(b.estTimeAdj - b.actual) / b.actual - Math.abs(a.estTimeAdj - a.actual) / a.actual).slice(0, 5).forEach((r) =>
    console.log(`  ${r.addr.padEnd(30)} actual $${r.actual.toLocaleString()} | est $${r.estTimeAdj.toLocaleString()} | ${(((r.estTimeAdj - r.actual) / r.actual) * 100).toFixed(1)}% | trend ${r.trend.toFixed(2)}%/mo`),
  );

  console.log("\nBest 5 (with 2D trend):");
  [...results].sort((a, b) => Math.abs(a.estTimeAdj - a.actual) / a.actual - Math.abs(b.estTimeAdj - b.actual) / b.actual).slice(0, 5).forEach((r) =>
    console.log(`  ${r.addr.padEnd(30)} actual $${r.actual.toLocaleString()} | est $${r.estTimeAdj.toLocaleString()} | ${(((r.estTimeAdj - r.actual) / r.actual) * 100).toFixed(1)}%`),
  );

  const latestTrend = results.length > 0 ? results[results.length - 1].trend : 0;
  console.log(`\nLatest trend in pool: ${latestTrend.toFixed(2)}%/mo (~${(latestTrend * 12).toFixed(1)}%/yr)`);
})();
