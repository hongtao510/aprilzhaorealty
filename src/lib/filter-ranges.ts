// Shared filter range definitions — keep in sync with
// NewsletterPreferences.tsx UI buckets. API, cron, and the browse
// page all import from here so the ranges are defined once.

export interface RangeBucket {
  key: string;
  min: number | null; // null = no lower bound
  max: number | null; // null = no upper bound
}

export const PRICE_RANGE_BUCKETS: RangeBucket[] = [
  { key: "0-1m", min: null, max: 1_000_000 },
  { key: "1m-1.5m", min: 1_000_000, max: 1_500_000 },
  { key: "1.5m-2m", min: 1_500_000, max: 2_000_000 },
  { key: "2m-2.5m", min: 2_000_000, max: 2_500_000 },
  { key: "2.5m-3m", min: 2_500_000, max: 3_000_000 },
  { key: "3m-4m", min: 3_000_000, max: 4_000_000 },
  { key: "4m-5m", min: 4_000_000, max: 5_000_000 },
  { key: "5m+", min: 5_000_000, max: null },
];

export const SQFT_RANGE_BUCKETS: RangeBucket[] = [
  { key: "0-1000", min: null, max: 1000 },
  { key: "1000-1500", min: 1000, max: 1500 },
  { key: "1500-2000", min: 1500, max: 2000 },
  { key: "2000-2500", min: 2000, max: 2500 },
  { key: "2500-3000", min: 2500, max: 3000 },
  { key: "3000-4000", min: 3000, max: 4000 },
  { key: "4000+", min: 4000, max: null },
];

const PRICE_KEY_SET = new Set(PRICE_RANGE_BUCKETS.map((b) => b.key));
const SQFT_KEY_SET = new Set(SQFT_RANGE_BUCKETS.map((b) => b.key));

export function isValidPriceKey(k: string): boolean {
  return PRICE_KEY_SET.has(k);
}
export function isValidSqftKey(k: string): boolean {
  return SQFT_KEY_SET.has(k);
}

/**
 * Returns true if `value` falls into ANY of the selected bucket keys.
 * If `selectedKeys` is empty, no filter applied — returns true.
 */
export function valueInAnyRange(
  value: number | null,
  selectedKeys: string[],
  buckets: RangeBucket[]
): boolean {
  if (selectedKeys.length === 0) return true;
  if (value == null) return false;
  const selected = buckets.filter((b) => selectedKeys.includes(b.key));
  return selected.some(
    (b) => (b.min == null || value >= b.min) && (b.max == null || value <= b.max)
  );
}
