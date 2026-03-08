"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import type { SavedHomePreview } from "@/lib/types";

export default function AdminSearchPage() {
  const [url, setUrl] = useState("");
  const [preview, setPreview] = useState<SavedHomePreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [beds, setBeds] = useState("");
  const [baths, setBaths] = useState("");
  const [sqft, setSqft] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  const fetchPreview = useCallback(async (inputUrl: string) => {
    if (!inputUrl.startsWith("http")) return;
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setLoadingPreview(true);
    setError("");
    try {
      const res = await fetch("/api/portal/saved-homes/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: inputUrl }),
        signal: abortRef.current.signal,
      });
      if (res.ok) {
        const data = await res.json();
        setPreview(data);
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
    } finally {
      setLoadingPreview(false);
    }
  }, []);

  function handleUrlChange(value: string) {
    setUrl(value);
    setSaved(false);
    setError("");
    setPreview(null);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (value.startsWith("http")) {
      debounceRef.current = setTimeout(() => {
        fetchPreview(value);
      }, 800);
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!url) return;

    setSaving(true);
    setError("");

    try {
      const res = await fetch("/api/admin/candidate-homes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          beds: beds ? parseInt(beds, 10) : undefined,
          baths: baths ? parseFloat(baths) : undefined,
          sqft: sqft ? parseInt(sqft, 10) : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to add");
        return;
      }

      setSaved(true);
      setUrl("");
      setPreview(null);
      setBeds("");
      setBaths("");
      setSqft("");
    } catch {
      setError("Failed to add listing");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="mb-8">
        <p className="text-[#d4a012] text-xs uppercase tracking-[0.3em] mb-2">
          Search
        </p>
        <h1 className="font-serif text-3xl text-neutral-900">Find Homes</h1>
        <div className="w-16 h-0.5 bg-[#d4a012] mt-4" />
      </div>

      {/* Step 1: Open Redfin */}
      <div className="mb-8">
        <h2 className="text-sm uppercase tracking-wider text-neutral-500 mb-3">
          Step 1: Browse Listings
        </h2>
        <a
          href="https://www.redfin.com"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 bg-[#d4a012] text-white px-6 py-3 text-sm uppercase tracking-wider hover:bg-[#b8890f] transition-colors"
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
              strokeWidth={2}
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
            />
          </svg>
          Search on Redfin
        </a>
        <p className="text-neutral-400 text-xs mt-2">
          Opens in a new tab. Copy the listing URL when you find a home you
          like.
        </p>
      </div>

      {/* Step 2: Paste URL */}
      <div className="mb-8">
        <h2 className="text-sm uppercase tracking-wider text-neutral-500 mb-3">
          Step 2: Add to Candidates
        </h2>

        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-2">
              Listing URL
            </label>
            <input
              type="url"
              value={url}
              onChange={(e) => handleUrlChange(e.target.value)}
              placeholder="Paste a Redfin, Zillow, or other listing URL..."
              className="w-full border border-neutral-200 px-4 py-3 text-sm text-neutral-900 placeholder-neutral-300 focus:outline-none focus:border-[#d4a012] transition-colors"
            />
          </div>

          {/* Preview */}
          {loadingPreview && (
            <div className="bg-neutral-50 border border-neutral-200 p-4">
              <p className="text-neutral-400 text-sm">Loading preview...</p>
            </div>
          )}

          {preview && !loadingPreview && (
            <div className="bg-neutral-50 border border-neutral-200 flex overflow-hidden">
              {preview.image_url && (
                <div className="w-40 flex-shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={preview.image_url}
                    alt={preview.address || "Preview"}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="p-4">
                {preview.price && (
                  <p className="font-serif text-xl text-neutral-900">
                    {preview.price}
                  </p>
                )}
                {preview.address && (
                  <p className="text-sm text-neutral-600 mt-1">
                    {preview.address}
                  </p>
                )}
                {!preview.price && !preview.address && preview.title && (
                  <p className="text-sm text-neutral-600">{preview.title}</p>
                )}
                {!preview.price && !preview.address && !preview.title && (
                  <p className="text-sm text-neutral-400">
                    No preview available — you can still save this URL.
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Property Details (optional) */}
          <div>
            <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-2">
              Property Details <span className="text-neutral-300">(optional — helps CMA accuracy)</span>
            </label>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <input
                  type="number"
                  value={beds}
                  onChange={(e) => setBeds(e.target.value)}
                  placeholder="Beds"
                  min="0"
                  className="w-full border border-neutral-200 px-4 py-3 text-sm text-neutral-900 placeholder-neutral-300 focus:outline-none focus:border-[#d4a012] transition-colors"
                />
              </div>
              <div>
                <input
                  type="number"
                  value={baths}
                  onChange={(e) => setBaths(e.target.value)}
                  placeholder="Baths"
                  min="0"
                  step="0.5"
                  className="w-full border border-neutral-200 px-4 py-3 text-sm text-neutral-900 placeholder-neutral-300 focus:outline-none focus:border-[#d4a012] transition-colors"
                />
              </div>
              <div>
                <input
                  type="number"
                  value={sqft}
                  onChange={(e) => setSqft(e.target.value)}
                  placeholder="Sqft"
                  min="0"
                  className="w-full border border-neutral-200 px-4 py-3 text-sm text-neutral-900 placeholder-neutral-300 focus:outline-none focus:border-[#d4a012] transition-colors"
                />
              </div>
            </div>
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          {saved && (
            <p className="text-green-600 text-sm">
              Home added to candidates! View it on the{" "}
              <a
                href="/admin/candidates"
                className="text-[#d4a012] underline"
              >
                Candidates
              </a>{" "}
              page.
            </p>
          )}

          <button
            type="submit"
            disabled={!url || saving}
            className="bg-neutral-900 text-white px-6 py-3 text-sm uppercase tracking-wider hover:bg-neutral-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {saving ? "Adding..." : "Add to Candidates"}
          </button>
        </form>
      </div>
    </div>
  );
}
