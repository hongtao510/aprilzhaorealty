import type { CompsEstimate } from "@/lib/types";

function formatPpsf(value: number | null): string {
  return value == null ? "No usable sales" : `$${value.toLocaleString()}/sqft`;
}

export default function PricingMethodSummary({ estimate }: { estimate: CompsEstimate }) {
  const method = estimate.pricing_methodology;
  if (!method) return null;

  const baselineLabel =
    method.baseline_source === "nearby_0_5_miles"
      ? "Nearby baseline"
      : method.baseline_source === "recent_zip_14_days"
        ? "Recent ZIP fallback"
        : "Selected-comp fallback";

  return (
    <div className="mt-3 rounded border border-neutral-200 bg-neutral-50 p-4">
      <p className="text-[10px] uppercase tracking-[0.18em] text-neutral-500">
        How this estimate was calculated
      </p>
      <div className="mt-3 grid grid-cols-1 gap-3 text-sm md:grid-cols-2">
        <div>
          <p className="font-medium text-neutral-900">{baselineLabel}</p>
          <p className="mt-1 text-neutral-600">
            {method.nearby_transaction_count} sale
            {method.nearby_transaction_count === 1 ? "" : "s"} within{" "}
            {method.nearby_radius_miles} miles over the last 12 months ·{" "}
            {formatPpsf(method.nearby_price_per_sqft)}
          </p>
        </div>
        <div>
          <p className="font-medium text-neutral-900">Current ZIP signal</p>
          <p className="mt-1 text-neutral-600">
            {method.recent_zip_transaction_count} sale
            {method.recent_zip_transaction_count === 1 ? "" : "s"} in{" "}
            {method.recent_zip ?? "the subject ZIP"} over the last 14 days ·{" "}
            {formatPpsf(method.recent_zip_price_per_sqft)} ·{" "}
            {method.recent_zip_weight_pct}% weight
          </p>
        </div>
      </div>
      {method.fallback_reason && (
        <p className="mt-3 text-xs text-amber-700">{method.fallback_reason}</p>
      )}
    </div>
  );
}
