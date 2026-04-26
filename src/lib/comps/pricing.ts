import type { CompHome, CompsEstimate } from "../types";

const ROUND_ESTIMATE_TO = 1_000;
const ROUND_RANGE_TO = 25_000;
const HALF_WIDTH_CAP = 200_000;
/** Minimum half-width as a fraction of the comp-based estimate. */
const HALF_WIDTH_PCT_FLOOR = 0.05;
/** Each outer band adds this fraction of the estimate to each side. */
const BAND_STEP_PCT = 0.06;

/** MAD-based outlier filter on $/sqft. Returns kept comps + dropped comps for diagnostics. */
export function trimPpsfOutliers<T extends { sold_price: number; sqft: number }>(
  comps: T[],
  options: { madMultiplier?: number; minComps?: number; hardLowRatio?: number; hardHighRatio?: number } = {},
): { kept: T[]; dropped: T[] } {
  const { madMultiplier = 2.5, minComps = 5, hardLowRatio = 0.7, hardHighRatio = 1.4 } = options;
  if (comps.length < minComps) return { kept: comps, dropped: [] };

  const ppsfs = comps.map((c) => c.sold_price / c.sqft);
  const sorted = [...ppsfs].sort((a, b) => a - b);
  const median = sorted.length % 2 === 0
    ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
    : sorted[Math.floor(sorted.length / 2)];

  const absDevs = ppsfs.map((p) => Math.abs(p - median)).sort((a, b) => a - b);
  const mad = absDevs.length % 2 === 0
    ? (absDevs[absDevs.length / 2 - 1] + absDevs[absDevs.length / 2]) / 2
    : absDevs[Math.floor(absDevs.length / 2)];

  const kept: T[] = [];
  const dropped: T[] = [];
  for (let i = 0; i < comps.length; i++) {
    const p = ppsfs[i];
    const ratio = p / median;
    const zish = mad > 0 ? Math.abs(p - median) / mad : 0;
    if (
      ratio < hardLowRatio ||
      ratio > hardHighRatio ||
      (mad > 0 && zish > madMultiplier)
    ) {
      dropped.push(comps[i]);
    } else {
      kept.push(comps[i]);
    }
  }
  // Don't strip below minComps — restore everything if we'd over-trim.
  if (kept.length < minComps) return { kept: comps, dropped: [] };
  return { kept, dropped };
}

function roundTo(value: number, step: number): number {
  return Math.round(value / step) * step;
}

/** Trend adjustment in percent for each market temperature; midpoints of the bands in the prompt. */
function trendPctFor(temp: CompsEstimate["market_temperature"]): number {
  if (temp === "hot") return 3.5;
  if (temp === "cool") return -3.5;
  return 0;
}

export interface PricingInput {
  subjectSqft: number;
  /** Lot size in sqft. Optional — when present, enables hybrid building+land pricing for small homes. */
  subjectLotSqft?: number | null;
  comps: (Pick<CompHome, "sold_price" | "sqft" | "similarity_score"> & {
    lot_sqft?: number | null;
  })[];
  marketTemperature: CompsEstimate["market_temperature"];
  /** Optional explicit trend percent; if omitted, we use the midpoint for the temperature. */
  trendPct?: number;
  /** Pricing strategy: "mean" (default), "median" (robust to bimodal pools), or "hybrid" (blend $/sqft + $/lot for small homes). */
  strategy?: "mean" | "median" | "hybrid";
  /** Use only the top-K comps by similarity_score for the estimate. Lower-ranked comps add noise. Backtests show K≈4 minimizes MAPE on Bay Area SFRs. */
  topK?: number;
}

/** Weighted median: the value where cumulative weight crosses 0.5. */
export function weightedMedian(values: number[], weights: number[]): number {
  if (values.length === 0) return 0;
  const pairs = values.map((v, i) => ({ v, w: weights[i] })).sort((a, b) => a.v - b.v);
  const totalWeight = pairs.reduce((s, p) => s + p.w, 0);
  if (totalWeight === 0) return pairs[Math.floor(pairs.length / 2)].v;
  let cum = 0;
  for (const p of pairs) {
    cum += p.w;
    if (cum >= totalWeight / 2) return p.v;
  }
  return pairs[pairs.length - 1].v;
}

export function computeEstimate(input: PricingInput): CompsEstimate {
  const { subjectSqft, subjectLotSqft, comps, marketTemperature } = input;
  const trendPct = input.trendPct ?? trendPctFor(marketTemperature);
  const strategy = input.strategy ?? "mean";

  const allValid = comps.filter(
    (c) =>
      Number.isFinite(c.sold_price) &&
      c.sold_price > 0 &&
      Number.isFinite(c.sqft) &&
      c.sqft > 0 &&
      Number.isFinite(c.similarity_score) &&
      c.similarity_score > 0,
  );

  // Restrict pricing math to top-K comps (default 4). Backtests show k=4 minimizes MAPE
  // on SF Peninsula SFRs — lower-ranked comps add noise without adding accuracy.
  const topK = input.topK ?? 4;
  const valid = topK > 0
    ? [...allValid].sort((a, b) => b.similarity_score - a.similarity_score).slice(0, topK)
    : allValid;

  if (valid.length === 0 || subjectSqft <= 0) {
    return {
      weighted_price_per_sqft: 0,
      comp_based: 0,
      trend_adjusted: 0,
      market_temperature: marketTemperature,
      trend_adjustment_pct: trendPct,
      range: {
        most_likely: [0, 0],
        likely: [0, 0],
        possible: [0, 0],
        unlikely_below: 0,
        unlikely_above: 0,
      },
    };
  }

  const weights = valid.map((c) => c.similarity_score);
  const weightSum = weights.reduce((s, w) => s + w, 0);
  const ppsfPerComp = valid.map((c) => c.sold_price / c.sqft);

  // Central tendency: weighted mean OR weighted median.
  const weightedPpsf =
    strategy === "median"
      ? weightedMedian(ppsfPerComp, weights)
      : valid.reduce((s, c, i) => s + ppsfPerComp[i] * c.similarity_score, 0) / weightSum;

  // Building component (always): subject's sqft * weighted central $/sqft.
  let compBasedRaw = weightedPpsf * subjectSqft;

  // Hybrid: blend in a $/lot-sqft signal. Useful when subject is small / on a buildable lot —
  // many small Bay Area homes trade more as lot value than building value.
  if (
    strategy === "hybrid" &&
    subjectLotSqft != null &&
    subjectLotSqft > 0
  ) {
    const lotPpsfs: number[] = [];
    const lotWeights: number[] = [];
    for (let i = 0; i < valid.length; i++) {
      const lot = valid[i].lot_sqft;
      if (lot != null && lot > 0) {
        lotPpsfs.push(valid[i].sold_price / lot);
        lotWeights.push(weights[i]);
      }
    }
    if (lotPpsfs.length >= 3) {
      const weightedLotPpsf = weightedMedian(lotPpsfs, lotWeights);
      const lotBased = weightedLotPpsf * subjectLotSqft;
      // Blend: small homes (<1500sf) lean toward lot value; large homes lean toward building value.
      const lotShare = Math.max(0, Math.min(0.5, (1500 - subjectSqft) / 3000));
      compBasedRaw = compBasedRaw * (1 - lotShare) + lotBased * lotShare;
    }
  }

  const compBased = roundTo(compBasedRaw, ROUND_ESTIMATE_TO);
  const trendAdjusted = roundTo(
    compBased * (1 + trendPct / 100),
    ROUND_ESTIMATE_TO,
  );

  // Range built from comp-implied prices at subject sqft, then trend-adjusted
  const compImpliedPrices = ppsfPerComp.map(
    (p) => p * subjectSqft * (1 + trendPct / 100),
  );

  // Use weighted mean for the *band center* even when the strategy is median —
  // the band reflects the spread of comp-implied prices, not the chosen estimator.
  const weightedMean =
    compImpliedPrices.reduce(
      (s, v, i) => s + v * valid[i].similarity_score,
      0,
    ) / weightSum;

  const weightedVariance =
    compImpliedPrices.reduce(
      (s, v, i) => s + valid[i].similarity_score * (v - weightedMean) ** 2,
      0,
    ) / weightSum;
  const std = Math.sqrt(weightedVariance);

  // Half-width = max(0.5·σ, 5% of estimate), capped at HALF_WIDTH_CAP.
  // The percentage floor ensures bands stay meaningful when comps are unusually concentrated.
  const stdBased = 0.5 * std;
  const pctFloor = HALF_WIDTH_PCT_FLOOR * compBased;
  const halfWidth = Math.min(Math.max(stdBased, pctFloor), HALF_WIDTH_CAP);
  const bandStep = Math.max(BAND_STEP_PCT * compBased, 100_000);

  // Center bands on the deterministic estimate, not the weighted mean — keeps them aligned
  // with the headline number even when median strategy diverges from the mean.
  const center = compBased;

  const mostLikely: [number, number] = [
    roundTo(center - halfWidth, ROUND_RANGE_TO),
    roundTo(center + halfWidth, ROUND_RANGE_TO),
  ];
  const likely: [number, number] = [
    roundTo(center - halfWidth - bandStep, ROUND_RANGE_TO),
    roundTo(center + halfWidth + bandStep, ROUND_RANGE_TO),
  ];
  const possible: [number, number] = [
    roundTo(center - halfWidth - 2 * bandStep, ROUND_RANGE_TO),
    roundTo(center + halfWidth + 2 * bandStep, ROUND_RANGE_TO),
  ];

  return {
    weighted_price_per_sqft: Math.round(weightedPpsf),
    comp_based: compBased,
    trend_adjusted: trendAdjusted,
    market_temperature: marketTemperature,
    trend_adjustment_pct: trendPct,
    range: {
      most_likely: mostLikely,
      likely,
      possible,
      unlikely_below: possible[0],
      unlikely_above: possible[1],
    },
  };
}
