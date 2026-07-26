import type { CompHome, CompsEstimate } from "../types";

const ROUND_ESTIMATE_TO = 1_000;
const ROUND_RANGE_TO = 25_000;
/** Minimum half-width as a fraction of the comp-based estimate. */
const HALF_WIDTH_PCT_FLOOR = 0.05;
/** Prevent a very dispersed pool from making the innermost band unusably wide. */
const HALF_WIDTH_PCT_CAP = 0.12;
/** Each outer band adds this fraction of the estimate to each side. */
const BAND_STEP_PCT = 0.06;
export const PRICING_METHOD_VERSION = 2;
export const NEARBY_RADIUS_MILES = 0.5;
export const NEARBY_LOOKBACK_DAYS = 365;
export const RECENT_ZIP_LOOKBACK_DAYS = 14;

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

export type PricingComp = Pick<CompHome, "sold_price" | "sqft" | "similarity_score"> & {
  address?: string;
  zip_code?: string | null;
  sold_date?: string;
  distance_miles?: number;
  lot_sqft?: number | null;
};

export interface PricingInput {
  subjectSqft: number;
  /** Retained for API compatibility; the current rule of thumb prices from building $/sqft. */
  subjectLotSqft?: number | null;
  /** User/AI-selected comps. Used as a fallback when the market pools are empty. */
  comps: PricingComp[];
  /** Full deterministic candidate pool used for nearby and current-ZIP pricing signals. */
  marketComps?: PricingComp[];
  subjectZip?: string | null;
  asOfDate?: Date;
  marketTemperature: CompsEstimate["market_temperature"];
  /** Fallback pricing strategy when neither preferred market pool has a usable sale. */
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

function extractZip(value: string | null | undefined): string | null {
  const match = value?.match(/\b(\d{5})(?:-\d{4})?\b/);
  return match?.[1] ?? null;
}

function daysSince(date: string | undefined, asOfDate: Date): number | null {
  if (!date) return null;
  const parsed = new Date(`${date}T12:00:00Z`);
  if (!Number.isFinite(parsed.getTime())) return null;
  return (asOfDate.getTime() - parsed.getTime()) / 86_400_000;
}

function validPricingComps(comps: PricingComp[]): PricingComp[] {
  return comps.filter(
    (c) =>
      Number.isFinite(c.sold_price) &&
      c.sold_price > 0 &&
      Number.isFinite(c.sqft) &&
      c.sqft > 0,
  );
}

function robustWeightedPpsf(
  comps: PricingComp[],
  weightFor: (comp: PricingComp) => number,
): number {
  if (comps.length === 0) return 0;
  const { kept } = trimPpsfOutliers(comps);
  return weightedMedian(
    kept.map((c) => c.sold_price / c.sqft),
    kept.map((c) => Math.max(weightFor(c), 0.001)),
  );
}

export function computeEstimate(input: PricingInput): CompsEstimate {
  const { subjectSqft, comps, marketTemperature } = input;
  const strategy = input.strategy ?? "mean";
  const asOfDate = input.asOfDate ?? new Date();
  const subjectZip = input.subjectZip ?? null;

  const allValid = validPricingComps(comps).filter(
    (c) => Number.isFinite(c.similarity_score) && c.similarity_score > 0,
  );
  const marketValid = validPricingComps(input.marketComps ?? comps);

  // Selected comps remain the safe fallback when neither preferred market signal exists.
  const topK = input.topK ?? 4;
  const fallbackComps = topK > 0
    ? [...allValid].sort((a, b) => b.similarity_score - a.similarity_score).slice(0, topK)
    : allValid;

  const nearbyComps = marketValid.filter((c) => {
    const ageDays = daysSince(c.sold_date, asOfDate);
    return (
      ageDays != null &&
      ageDays >= 0 &&
      ageDays <= NEARBY_LOOKBACK_DAYS &&
      Number.isFinite(c.distance_miles) &&
      (c.distance_miles as number) >= 0 &&
      (c.distance_miles as number) <= NEARBY_RADIUS_MILES
    );
  });

  const recentZipComps = subjectZip
    ? marketValid.filter((c) => {
        const ageDays = daysSince(c.sold_date, asOfDate);
        const compZip = c.zip_code ?? extractZip(c.address);
        return (
          compZip === subjectZip &&
          ageDays != null &&
          ageDays >= 0 &&
          ageDays <= RECENT_ZIP_LOOKBACK_DAYS
        );
      })
    : [];

  const nearbyPpsf = robustWeightedPpsf(nearbyComps, (c) => {
    const ageDays = daysSince(c.sold_date, asOfDate) ?? NEARBY_LOOKBACK_DAYS;
    const distance = c.distance_miles ?? NEARBY_RADIUS_MILES;
    return Math.exp(-ageDays / 180) * Math.exp(-distance / NEARBY_RADIUS_MILES);
  });
  const recentZipPpsf = robustWeightedPpsf(recentZipComps, (c) => {
    const ageDays = daysSince(c.sold_date, asOfDate) ?? RECENT_ZIP_LOOKBACK_DAYS;
    return Math.exp(-ageDays / RECENT_ZIP_LOOKBACK_DAYS);
  });

  let baselineSource: NonNullable<CompsEstimate["pricing_methodology"]>["baseline_source"];
  let baselinePool: PricingComp[];
  let baselinePpsf: number;
  let fallbackReason: string | null = null;

  if (nearbyPpsf > 0) {
    baselineSource = "nearby_0_5_miles";
    baselinePool = nearbyComps;
    baselinePpsf = nearbyPpsf;
  } else if (recentZipPpsf > 0) {
    baselineSource = "recent_zip_14_days";
    baselinePool = recentZipComps;
    baselinePpsf = recentZipPpsf;
    fallbackReason = "No usable sale was found within 0.5 miles in the last 12 months.";
  } else {
    baselineSource = "selected_comps";
    baselinePool = fallbackComps;
    const fallbackWeights = fallbackComps.map((c) => c.similarity_score);
    const fallbackPpsfs = fallbackComps.map((c) => c.sold_price / c.sqft);
    baselinePpsf =
      strategy === "median" || strategy === "hybrid"
        ? weightedMedian(fallbackPpsfs, fallbackWeights)
        : fallbackComps.reduce(
            (sum, c, index) => sum + fallbackPpsfs[index] * c.similarity_score,
            0,
          ) / fallbackWeights.reduce((sum, weight) => sum + weight, 0);
    fallbackReason =
      "No usable nearby sale or same-ZIP sale from the last 14 days was found; selected comps were used.";
  }

  const methodologyBase = {
    version: PRICING_METHOD_VERSION,
    baseline_source: baselineSource,
    nearby_radius_miles: NEARBY_RADIUS_MILES,
    nearby_lookback_days: NEARBY_LOOKBACK_DAYS,
    nearby_transaction_count: nearbyComps.length,
    nearby_price_per_sqft: nearbyPpsf > 0 ? Math.round(nearbyPpsf) : null,
    recent_zip: subjectZip,
    recent_zip_lookback_days: RECENT_ZIP_LOOKBACK_DAYS,
    recent_zip_transaction_count: recentZipComps.length,
    recent_zip_price_per_sqft: recentZipPpsf > 0 ? Math.round(recentZipPpsf) : null,
    recent_zip_weight_pct: 0,
    fallback_reason: fallbackReason,
  } satisfies NonNullable<CompsEstimate["pricing_methodology"]>;

  if (baselinePool.length === 0 || !Number.isFinite(baselinePpsf) || baselinePpsf <= 0 || subjectSqft <= 0) {
    return {
      weighted_price_per_sqft: 0,
      current_price_per_sqft: 0,
      comp_based: 0,
      trend_adjusted: 0,
      market_temperature: marketTemperature,
      trend_adjustment_pct: 0,
      pricing_methodology: methodologyBase,
      range: {
        most_likely: [0, 0],
        likely: [0, 0],
        possible: [0, 0],
        unlikely_below: 0,
        unlikely_above: 0,
      },
    };
  }

  // Recent same-ZIP transactions directly influence the current $/sqft. One sale carries 25%;
  // the signal rises to 40% with four or more sales. Cap the ZIP signal to ±15% of the
  // hyper-local baseline so a single atypical transaction cannot dominate the estimate.
  let recentZipWeight = 0;
  let currentPpsf = baselinePpsf;
  if (baselineSource === "nearby_0_5_miles" && recentZipPpsf > 0) {
    recentZipWeight = Math.min(0.4, 0.2 + 0.05 * recentZipComps.length);
    const cappedRecentZipPpsf = Math.min(
      Math.max(recentZipPpsf, baselinePpsf * 0.85),
      baselinePpsf * 1.15,
    );
    currentPpsf =
      baselinePpsf * (1 - recentZipWeight) + cappedRecentZipPpsf * recentZipWeight;
  } else if (baselineSource === "recent_zip_14_days") {
    recentZipWeight = 1;
  }

  const compBased = roundTo(baselinePpsf * subjectSqft, ROUND_ESTIMATE_TO);
  const trendAdjusted = roundTo(currentPpsf * subjectSqft, ROUND_ESTIMATE_TO);
  const currentAdjustmentPct =
    compBased > 0 ? ((trendAdjusted / compBased) - 1) * 100 : 0;

  // Range uses the same evidence pool as the baseline and is centered on the current price.
  const currentMultiplier = baselinePpsf > 0 ? currentPpsf / baselinePpsf : 1;
  const compImpliedPrices = baselinePool.map(
    (c) => (c.sold_price / c.sqft) * subjectSqft * currentMultiplier,
  );
  const weights = baselinePool.map((c) => {
    if (baselineSource === "nearby_0_5_miles") {
      const ageDays = daysSince(c.sold_date, asOfDate) ?? NEARBY_LOOKBACK_DAYS;
      const distance = c.distance_miles ?? NEARBY_RADIUS_MILES;
      return Math.max(Math.exp(-ageDays / 180) * Math.exp(-distance / NEARBY_RADIUS_MILES), 0.001);
    }
    if (baselineSource === "recent_zip_14_days") {
      const ageDays = daysSince(c.sold_date, asOfDate) ?? RECENT_ZIP_LOOKBACK_DAYS;
      return Math.max(Math.exp(-ageDays / RECENT_ZIP_LOOKBACK_DAYS), 0.001);
    }
    return Math.max(c.similarity_score, 0.001);
  });
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0);

  const weightedMean =
    compImpliedPrices.reduce(
      (s, v, i) => s + v * weights[i],
      0,
    ) / weightSum;

  const weightedVariance =
    compImpliedPrices.reduce(
      (s, v, i) => s + weights[i] * (v - weightedMean) ** 2,
      0,
    ) / weightSum;
  const std = Math.sqrt(weightedVariance);

  // Percentage-based bounds scale appropriately for both entry-level and luxury homes.
  const stdBased = 0.5 * std;
  const pctFloor = HALF_WIDTH_PCT_FLOOR * trendAdjusted;
  const halfWidth = Math.min(
    Math.max(stdBased, pctFloor),
    HALF_WIDTH_PCT_CAP * trendAdjusted,
  );
  const bandStep = Math.max(BAND_STEP_PCT * trendAdjusted, 100_000);

  const center = trendAdjusted;

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
    weighted_price_per_sqft: Math.round(baselinePpsf),
    current_price_per_sqft: Math.round(currentPpsf),
    comp_based: compBased,
    trend_adjusted: trendAdjusted,
    market_temperature: marketTemperature,
    trend_adjustment_pct: Number(currentAdjustmentPct.toFixed(1)),
    pricing_methodology: {
      ...methodologyBase,
      recent_zip_weight_pct: Math.round(recentZipWeight * 100),
    },
    range: {
      most_likely: mostLikely,
      likely,
      possible,
      unlikely_below: possible[0],
      unlikely_above: possible[1],
    },
  };
}
