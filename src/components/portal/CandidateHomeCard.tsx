"use client";

import type { CandidateHome } from "@/lib/types";

type CardStatus = "new" | "saved" | "dismissed";

interface CandidateHomeCardProps {
  home: CandidateHome;
  onStatusChange?: (id: string, status: CardStatus) => void;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}

const statusColors: Record<string, { bg: string; text: string; label: string }> = {
  new: { bg: "bg-emerald-100", text: "text-emerald-700", label: "New" },
  saved: { bg: "bg-blue-100", text: "text-blue-700", label: "Saved" },
  sent: { bg: "bg-violet-100", text: "text-violet-700", label: "Sent" },
  dismissed: { bg: "bg-neutral-100", text: "text-neutral-500", label: "Dismissed" },
};

const statusOptions: { value: CardStatus; label: string }[] = [
  { value: "new", label: "New" },
  { value: "saved", label: "Saved" },
  { value: "dismissed", label: "Dismissed" },
];

export default function CandidateHomeCard({
  home,
  onStatusChange,
  selectable = false,
  selected = false,
  onToggleSelect,
}: CandidateHomeCardProps) {
  const badge = statusColors[home.status] || statusColors.new;

  return (
    <div
      className={`bg-neutral-50 border transition-colors group ${
        selectable && selected
          ? "border-[#d4a012] ring-2 ring-[#d4a012]/30"
          : "border-neutral-200 hover:border-[#d4a012]"
      }`}
    >
      <div className="relative">
        {selectable && (
          <button
            type="button"
            onClick={() => onToggleSelect?.(home.id)}
            className="absolute top-3 left-3 z-10 w-6 h-6 rounded border-2 flex items-center justify-center transition-colors cursor-pointer"
            style={{
              backgroundColor: selected ? "#d4a012" : "rgba(255,255,255,0.9)",
              borderColor: selected ? "#d4a012" : "#d1d5db",
            }}
          >
            {selected && (
              <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>
        )}

        {/* Status badge */}
        <span className={`absolute top-3 right-3 z-10 px-2 py-0.5 text-[10px] uppercase tracking-wider font-medium rounded ${badge.bg} ${badge.text}`}>
          {badge.label}
        </span>

        {home.image_url ? (
          <div className="aspect-[16/10] overflow-hidden bg-neutral-100">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={home.image_url}
              alt={home.address || "Candidate home"}
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <div className="aspect-[16/10] bg-neutral-100 flex items-center justify-center">
            <svg
              className="w-10 h-10 text-neutral-300"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
              />
            </svg>
          </div>
        )}
      </div>

      <div className="p-4">
        {home.price && (
          <p className="font-serif text-xl text-neutral-900 mb-1">
            {home.price}
          </p>
        )}

        {/* Beds / Baths / Sqft row */}
        {(home.beds || home.baths || home.sqft) && (
          <p className="text-sm text-neutral-500 mb-1">
            {[
              home.beds ? `${home.beds} bd` : null,
              home.baths ? `${home.baths} ba` : null,
              home.sqft ? `${home.sqft.toLocaleString()} sqft` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}

        {home.address && (
          <p className="text-sm text-neutral-600 mb-1">{home.address}</p>
        )}

        {/* RentCast valuation */}
        {home.valuation && (
          <p className="text-xs text-emerald-600 font-medium mb-1">
            Est. ${home.valuation.toLocaleString()}
            {home.valuation_low && home.valuation_high && (
              <span className="text-neutral-400 font-normal">
                {" "}({`$${home.valuation_low.toLocaleString()} – $${home.valuation_high.toLocaleString()}`})
              </span>
            )}
          </p>
        )}

        {/* Extra details */}
        {(home.lot_sqft || home.year_built || home.property_type) && (
          <p className="text-xs text-neutral-400 mb-1">
            {[
              home.lot_sqft ? `${home.lot_sqft.toLocaleString()} sqft lot` : null,
              home.year_built ? `Built ${home.year_built}` : null,
              home.property_type || null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        )}

        {home.notes && (
          <p className="text-xs text-neutral-400 italic mb-3">{home.notes}</p>
        )}

        <div className="flex items-center gap-3 pt-2 border-t border-neutral-100">
          <a
            href={home.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs uppercase tracking-wider text-[#d4a012] hover:text-[#b8890f] transition-colors"
          >
            View Listing
          </a>

          <a
            href={`/comps/${home.id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 text-white text-xs uppercase tracking-wider hover:bg-neutral-700 transition-colors rounded"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Find Comps
          </a>

          {onStatusChange && (
            <select
              value={home.status === "sent" ? "saved" : home.status}
              onChange={(e) => onStatusChange(home.id, e.target.value as CardStatus)}
              className="ml-auto text-xs uppercase tracking-wider text-neutral-500 bg-transparent border border-neutral-200 rounded px-2 py-1 focus:outline-none focus:border-[#d4a012] cursor-pointer"
            >
              {statusOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          )}
        </div>

        <p className="text-xs text-neutral-300 mt-2">
          Added {new Date(home.created_at).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}
