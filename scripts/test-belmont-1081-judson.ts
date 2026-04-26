import { computeEstimate } from "../src/lib/comps/pricing";

const today = new Date("2026-04-26");
const subject = { sqft: 1210, beds: 3, baths: 1, lot: 5001 };

type Row = { date: string; addr: string; price: number; beds: number; baths: number; sqft: number; lot: number; yb: number; ppsf: number };

const raw: Row[] = `December-22-2025|615 Wellington Dr|2300000|3|2.0|2100|6965|1953|1095
February-27-2026|537 Prospect St|2750000|3|2.0|2100|6647|1951|1310
January-20-2026|125 Chestnut St|2925000|4|3.0|1906|6759|1947|1535
April-1-2026|33 Cambridge St|2900000|4|3.0|1920|5695|1946|1510
February-13-2026|444 Hillcrest Rd|2850000|4|3.5|2890|5733|1966|986
November-19-2025|1172 Elm St|1915000|3|2.0|1150|4800|1949|1665
January-28-2026|151 Highland Ave|2700000|4|3.5|2450|11399|1973|1102
March-9-2026|2080 Arroyo Dr|4050000|4|3.0|2660|5000|1946|1523
January-16-2026|2109 Cipriani Blvd|3000000|4|3.5|2250|6998|1962|1333
November-17-2025|1715 El Verano Way|2250000|3|2.0|1220|7012|1956|1844
March-4-2026|313 Clifton Ave|3750000|5|3.5|3330|7747|1988|1126
February-4-2026|87 Exeter Ave|2850000|4|3.0|2604|8295|1965|1094
February-12-2026|10 Colegrove Ct|1585000|2|2.0|1100|4770|1947|1441
March-13-2026|513 Chesterton Ave|1840000|3|1.0|1010|5000|1953|1822
November-10-2025|535 Lanyard Dr|1907777|3|2.0|1200|8093|1971|1590
March-27-2026|2018 Monroe Ave|1600000|3|1.0|1143|4000|1951|1400
February-24-2026|1316 Rosewood Ave|3100000|3|2.0|1906|4900|1945|1626
February-27-2026|1306 North Rd|2501000|3|2.0|1650|7347|1957|1516
March-20-2026|2404 Cipriani Blvd|2150000|3|1.0|1280|5565|1953|1680
April-3-2026|354 Devonshire Blvd|2925000|4|2.0|1940|17531|1962|1508
February-6-2026|828 Cordilleras Ave|3100000|3|2.0|2020|7252|1942|1535
March-24-2026|1731 Francis Ct|2100000|2|1.5|1340|5565|1947|1567
December-5-2025|1316 ELM St|3300000|4|3.0|1957|4800|1951|1686
October-28-2025|1020 Inverness Dr|1350000|2|1.0|820|5000|1948|1646
March-17-2026|55 Burbank Ave|1380000|2|1.0|910|5044|1942|1516
April-20-2026|1709 Hillman Ave|2050000|3|2.5|1630|7728|1945|1258
April-1-2026|516 Cringle Dr|2610000|4|2.0|1650|6800|1969|1582
November-20-2025|1701 Valley View Ave|2050000|3|1.0|1550|10374|1947|1323
March-11-2026|217 Bay View Dr|3060000|4|2.5|2630|10534|1959|1163`
  .split("\n")
  .map((l) => {
    const [date, addr, price, beds, baths, sqft, lot, yb, ppsf] = l.split("|");
    return { date, addr, price: +price, beds: +beds, baths: +baths, sqft: +sqft, lot: +lot, yb: +yb, ppsf: +ppsf };
  });

const monthsAgo = (d: string) => {
  const dd = new Date(d.replace(/-/g, " "));
  return (today.getTime() - dd.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
};
const recency = (mo: number) => (mo <= 3 ? 1.0 : mo <= 6 ? 0.95 : mo <= 9 ? 0.85 : mo <= 12 ? 0.7 : 0);

const scored = raw
  .map((c) => {
    const mo = monthsAgo(c.date);
    if (mo > 12) return null;
    const sizeScore = Math.max(0, 1 - Math.abs(c.sqft - subject.sqft) / subject.sqft / 0.2);
    const bbScore = Math.max(0, 1 - Math.abs(c.beds + c.baths - (subject.beds + subject.baths)) / 3);
    const lotScore = Math.max(0, 1 - Math.abs(c.lot - subject.lot) / subject.lot / 0.3);
    const sim = 0.5 * sizeScore + 0.3 * bbScore + 0.2 * lotScore;
    if (sim === 0) return null;
    const total = sim * recency(mo);
    return { ...c, mo: +mo.toFixed(1), sim: +sim.toFixed(3), recency: recency(mo), total: +total.toFixed(3) };
  })
  .filter((x): x is NonNullable<typeof x> => x !== null)
  .sort((a, b) => b.total - a.total);

const top = scored.slice(0, 8);
console.log("\nSubject: 1081 Judson St, Belmont 94002 — 3bd/1ba, 1210sf, lot 5001, built 1947");
console.log("List price: $1,288,000 | Redfin estimate range: $1,465,000–$2,183,000\n");
console.log("TOP 8 COMPS (by current similarity * recency):");
top.forEach((c) =>
  console.log(
    `  ${c.total.toFixed(3)} | ${c.date} | ${c.addr.padEnd(28)} $${(c.price / 1e6).toFixed(2)}M | ${c.beds}/${c.baths} | ${c.sqft}sf | lot ${c.lot} | $${c.ppsf}/sf | sim ${c.sim} (${c.mo}mo)`,
  ),
);

const est = computeEstimate({
  subjectSqft: subject.sqft,
  comps: top.map((c) => ({ sold_price: c.price, sqft: c.sqft, similarity_score: c.total })),
  marketTemperature: "warm",
});

console.log("\nDETERMINISTIC ESTIMATE (computeEstimate):");
console.log(`  Weighted $/sqft:     $${est.weighted_price_per_sqft.toLocaleString()}`);
console.log(`  Comp-based:          $${est.comp_based.toLocaleString()}`);
console.log(`  Trend-adjusted:      $${est.trend_adjusted.toLocaleString()}  (${est.market_temperature}, ${est.trend_adjustment_pct}%)`);
console.log(`  Most likely (50%):   $${est.range.most_likely[0].toLocaleString()} – $${est.range.most_likely[1].toLocaleString()}`);
console.log(`  Likely (75%):        $${est.range.likely[0].toLocaleString()} – $${est.range.likely[1].toLocaleString()}`);
console.log(`  Possible (90%):      $${est.range.possible[0].toLocaleString()} – $${est.range.possible[1].toLocaleString()}`);

console.log(`\nRedfin official estimate: $1,465,000 – $2,183,000`);
console.log(`Listed at: $1,288,000`);
