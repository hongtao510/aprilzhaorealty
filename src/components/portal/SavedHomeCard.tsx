"use client";

import type { SavedHome } from "@/lib/types";

interface SavedHomeCardProps {
  home: SavedHome;
  onRemove?: (id: string) => void;
  showRemove?: boolean;
}

export default function SavedHomeCard({
  home,
  onRemove,
  showRemove = true,
}: SavedHomeCardProps) {
  return (
    <div className="bg-neutral-50 border border-neutral-200 hover:border-[#d4a012] transition-colors group">
      {home.image_url ? (
        <div className="aspect-[16/10] overflow-hidden bg-neutral-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={home.image_url}
            alt={home.address || "Saved home"}
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

      <div className="p-4">
        {home.price && (
          <p className="font-serif text-xl text-neutral-900 mb-1">
            {home.price}
          </p>
        )}
        {home.address && (
          <p className="text-sm text-neutral-600 mb-2">{home.address}</p>
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
          {showRemove && onRemove && (
            <button
              onClick={() => onRemove(home.id)}
              className="text-xs uppercase tracking-wider text-neutral-400 hover:text-red-500 transition-colors ml-auto"
            >
              Remove
            </button>
          )}
        </div>

        <p className="text-xs text-neutral-300 mt-2">
          Saved {new Date(home.created_at).toLocaleDateString()}
        </p>
      </div>
    </div>
  );
}
