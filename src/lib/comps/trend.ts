import type { RawComp } from "../types";

export interface TrendResult {
  /** Average month-over-month change in $/sqft expressed as a percent. Positive = appreciating. */
  monthly_drift_pct: number;
  /** Annualized version of the same drift. */
  annualized_pct: number;
  /** Predicted-vs-asOf adjustment to apply to a comp that sold N months ago: (asOf - comp_sold) * monthly_drift_pct / 100. */
  /** R^2 of the regression, 0..1 — confidence in the slope. */
  r_squared: number;
  /** Number of comps used in the fit. */
  n: number;
  /** Inferred temperature label from monthly drift (mirrors LLM market_temperature for narrative). */
  temperature: "hot" | "warm" | "cool";
}

const MIN_FIT_COMPS = 25;
const MIN_R_SQUARED = 0.25;
/** Hard cap — any "drift" beyond this is composition noise, not a real market move. */
const MAX_MONTHLY_DRIFT_PCT = 1.5;

/**
 * Linear regression of $/sqft vs months_before_asOf, computed from the comp pool itself.
 * Returns the empirical monthly drift the market is experiencing.
 *
 * If we have too few comps or a weak fit (low R²), returns flat (0%) trend.
 */
export function computeTrendFromComps(
  comps: RawComp[],
  asOfDate: Date,
  windowMonths = 12,
): TrendResult {
  const points: { x: number; y: number }[] = [];
  for (const c of comps) {
    if (!c.sold_date || c.sqft <= 0 || c.sold_price <= 0) continue;
    const sold = new Date(c.sold_date);
    if (isNaN(sold.getTime())) continue;
    const months = (asOfDate.getTime() - sold.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
    if (months < 0 || months > windowMonths) continue;
    points.push({ x: -months, y: c.sold_price / c.sqft }); // x positive when more recent
  }

  if (points.length < MIN_FIT_COMPS) {
    return { monthly_drift_pct: 0, annualized_pct: 0, r_squared: 0, n: points.length, temperature: "warm" };
  }

  const n = points.length;
  const meanX = points.reduce((s, p) => s + p.x, 0) / n;
  const meanY = points.reduce((s, p) => s + p.y, 0) / n;
  let sxx = 0, sxy = 0, syy = 0;
  for (const p of points) {
    sxx += (p.x - meanX) ** 2;
    sxy += (p.x - meanX) * (p.y - meanY);
    syy += (p.y - meanY) ** 2;
  }
  if (sxx === 0 || syy === 0) {
    return { monthly_drift_pct: 0, annualized_pct: 0, r_squared: 0, n, temperature: "warm" };
  }
  const slope = sxy / sxx; // $ per sqft per month (positive = appreciating)
  const r = sxy / Math.sqrt(sxx * syy);
  const r_squared = r * r;

  // Convert slope to a percentage of the mean.
  const raw_monthly = (slope / meanY) * 100;

  // Gate: require minimum R². Below threshold, the slope is dominated by composition noise,
  // not a real market move — return flat trend.
  if (r_squared < MIN_R_SQUARED) {
    return { monthly_drift_pct: 0, annualized_pct: 0, r_squared, n, temperature: "warm" };
  }

  // Hard cap to avoid composition-bias amplification (e.g., bimodal premium-vs-flatland pools).
  const drift = Math.max(-MAX_MONTHLY_DRIFT_PCT, Math.min(MAX_MONTHLY_DRIFT_PCT, raw_monthly));

  const temperature: TrendResult["temperature"] =
    drift > 0.5 ? "hot" : drift < -0.5 ? "cool" : "warm";

  return {
    monthly_drift_pct: drift,
    annualized_pct: drift * 12,
    r_squared,
    n,
    temperature,
  };
}

/**
 * Adjust a comp's sold price to "as if it sold today" using the empirical monthly drift.
 * trend_adjusted_price = sold_price * (1 + monthly_drift_pct / 100) ^ months_ago
 */
export function timeAdjustPrice(
  soldPrice: number,
  soldDate: string,
  asOfDate: Date,
  monthlyDriftPct: number,
): number {
  const sold = new Date(soldDate);
  if (isNaN(sold.getTime())) return soldPrice;
  const months = (asOfDate.getTime() - sold.getTime()) / (1000 * 60 * 60 * 24 * 30.44);
  if (months <= 0) return soldPrice;
  return soldPrice * Math.pow(1 + monthlyDriftPct / 100, months);
}
