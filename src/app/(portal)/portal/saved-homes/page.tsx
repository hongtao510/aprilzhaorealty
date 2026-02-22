"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { SavedHome } from "@/lib/types";
import SavedHomeCard from "@/components/portal/SavedHomeCard";

export default function SavedHomesPage() {
  const [homes, setHomes] = useState<SavedHome[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchHomes() {
      try {
        const res = await fetch("/api/portal/saved-homes");
        if (res.ok) {
          const data = await res.json();
          setHomes(data);
        }
      } catch {
        // fail silently
      } finally {
        setLoading(false);
      }
    }
    fetchHomes();
  }, []);

  async function handleRemove(id: string) {
    if (!confirm("Remove this saved home?")) return;
    try {
      const res = await fetch(`/api/portal/saved-homes/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setHomes(homes.filter((h) => h.id !== id));
      }
    } catch {
      // fail silently
    }
  }

  function handlePlanRoute() {
    const addresses = homes
      .map((h) => h.address)
      .filter((a): a is string => !!a);
    if (addresses.length === 0) return;

    const waypoints = addresses.map((a) => encodeURIComponent(a)).join("/");
    const url = `https://www.google.com/maps/dir/${waypoints}`;
    window.open(url, "_blank");
  }

  return (
    <div>
      <div className="mb-8">
        <p className="text-[#d4a012] text-xs uppercase tracking-[0.3em] mb-2">
          Your Collection
        </p>
        <h1 className="font-serif text-3xl text-neutral-900">Saved Homes</h1>
        <div className="w-16 h-0.5 bg-[#d4a012] mt-4" />
      </div>

      {loading ? (
        <p className="text-neutral-400 text-sm">Loading...</p>
      ) : homes.length === 0 ? (
        <div className="bg-neutral-50 border border-neutral-200 p-8 text-center">
          <p className="text-neutral-500 text-sm mb-4">
            No saved homes yet. Start by searching for listings.
          </p>
          <Link
            href="/portal/search"
            className="inline-block bg-[#d4a012] text-white px-6 py-3 text-sm uppercase tracking-wider hover:bg-[#b8890f] transition-colors"
          >
            Search Homes
          </Link>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-4 mb-6">
            <p className="text-sm text-neutral-500">
              {homes.length} saved {homes.length === 1 ? "home" : "homes"}
            </p>
            {homes.some((h) => h.address) && (
              <button
                onClick={handlePlanRoute}
                className="inline-flex items-center gap-2 bg-neutral-900 text-white px-4 py-2 text-xs uppercase tracking-wider hover:bg-neutral-800 transition-colors"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                  />
                </svg>
                Plan Route
              </button>
            )}
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {homes.map((home) => (
              <SavedHomeCard
                key={home.id}
                home={home}
                onRemove={handleRemove}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
