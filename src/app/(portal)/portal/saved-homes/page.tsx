"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { SavedHome } from "@/lib/types";
import SavedHomeCard from "@/components/portal/SavedHomeCard";

/** Extract a clean street address from scraped listing text.
 *  Strips property names, bed/bath counts, sqft, and other metadata. */
function extractRouteAddress(raw: string): string {
  // Strip bed/bath suffixes  (e.g. "- 2 beds/2.5 baths", "2 bed | 1 bath")
  let cleaned = raw
    .replace(/[-–—]?\s*\d+\.?\d*\s*beds?\s*[/|,]\s*\d+\.?\d*\s*baths?.*/i, "")
    // Strip sqft  (e.g. "- 1,200 sqft", "1200 sq ft")
    .replace(/[-–—]?\s*[\d,]+\s*sq\.?\s*ft\.?.*/i, "")
    .trim()
    .replace(/[-–—,\s]+$/, "")
    .trim();

  // Extract "123 Street, City, ST 12345" pattern (skips leading property names)
  const match = cleaned.match(
    /(\d+\s[^,]+(?:,\s*[^,]+)*,\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?)/
  );
  if (match) return match[1].trim();

  return cleaned;
}

export default function SavedHomesPage() {
  const [homes, setHomes] = useState<SavedHome[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRoutePlanner, setShowRoutePlanner] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [startingLocation, setStartingLocation] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Email mode state
  const [showEmailPanel, setShowEmailPanel] = useState(false);
  const [emailSelectedIds, setEmailSelectedIds] = useState<Set<string>>(new Set());
  const [emailComments, setEmailComments] = useState<Map<string, string>>(new Map());
  const [recipientEmail, setRecipientEmail] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailError, setEmailError] = useState("");

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

  // --- Route planner handlers ---

  function handleTogglePlanner() {
    if (!showRoutePlanner) {
      setSelectedIds(new Set(homes.filter((h) => h.address).map((h) => h.id)));
      setStartingLocation("");
      // Close email panel if open
      setShowEmailPanel(false);
      setEmailSent(false);
      setEmailError("");
    }
    setPreviewUrl(null);
    setShowRoutePlanner(!showRoutePlanner);
  }

  function handleToggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function handleSelectAll() {
    const addressableIds = homes.filter((h) => h.address).map((h) => h.id);
    const allSelected = addressableIds.every((id) => selectedIds.has(id));
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(addressableIds));
    }
  }

  function buildRouteAddresses() {
    const selected = homes.filter(
      (h) => selectedIds.has(h.id) && h.address
    );
    if (selected.length === 0) return null;

    const addresses = selected.map((h) => extractRouteAddress(h.address!));
    const origin = startingLocation.trim() || addresses[0];
    const destinations = startingLocation.trim() ? addresses : addresses.slice(1);
    return { origin, destinations };
  }

  function handleOpenRoute() {
    const route = buildRouteAddresses();
    if (!route) return;

    const waypoints = [route.origin, ...route.destinations]
      .map((a) => encodeURIComponent(a))
      .join("/");
    const url = `https://www.google.com/maps/dir/${waypoints}`;
    window.open(url, "_blank");
  }

  function handlePreviewRoute() {
    const route = buildRouteAddresses();
    if (!route) return;

    const saddr = encodeURIComponent(route.origin);
    const daddr = route.destinations
      .map((a) => encodeURIComponent(a))
      .join("+to:");
    setPreviewUrl(
      `https://maps.google.com/maps?saddr=${saddr}&daddr=${daddr}&output=embed`
    );
  }

  // --- Email mode handlers ---

  function handleToggleEmailPanel() {
    if (!showEmailPanel) {
      // Opening email panel — select all homes, close route planner
      setEmailSelectedIds(new Set(homes.map((h) => h.id)));
      setEmailComments(new Map());
      setRecipientEmail("");
      setEmailSubject("");
      setEmailSent(false);
      setEmailError("");
      setShowRoutePlanner(false);
      setPreviewUrl(null);
    }
    setShowEmailPanel(!showEmailPanel);
  }

  function handleEmailToggleSelect(id: string) {
    setEmailSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function handleEmailSelectAll() {
    const allIds = homes.map((h) => h.id);
    const allSelected = allIds.every((id) => emailSelectedIds.has(id));
    if (allSelected) {
      setEmailSelectedIds(new Set());
    } else {
      setEmailSelectedIds(new Set(allIds));
    }
  }

  function handleCommentChange(id: string, comment: string) {
    setEmailComments((prev) => {
      const next = new Map(prev);
      next.set(id, comment);
      return next;
    });
  }

  async function handleSendEmail() {
    setEmailError("");
    setSendingEmail(true);

    const selectedHomes = homes.filter((h) => emailSelectedIds.has(h.id));
    const payload = {
      recipientEmail,
      subject: emailSubject.trim() || undefined,
      homes: selectedHomes.map((h) => ({
        id: h.id,
        url: h.url,
        title: h.title,
        image_url: h.image_url,
        address: h.address,
        price: h.price,
        comment: emailComments.get(h.id) || "",
      })),
    };

    try {
      const res = await fetch("/api/portal/saved-homes/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setEmailError(data.error || "Failed to send email");
      } else {
        setEmailSent(true);
      }
    } catch {
      setEmailError("An unexpected error occurred. Please try again.");
    } finally {
      setSendingEmail(false);
    }
  }

  // Determine which mode is active for card props
  const isSelectableMode = showRoutePlanner || showEmailPanel;
  const activeSelectedIds = showEmailPanel ? emailSelectedIds : selectedIds;
  const activeToggleSelect = showEmailPanel ? handleEmailToggleSelect : handleToggleSelect;

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
                onClick={handleTogglePlanner}
                className={`inline-flex items-center gap-2 px-4 py-2 text-xs uppercase tracking-wider transition-colors ${
                  showRoutePlanner
                    ? "bg-neutral-200 text-neutral-700 hover:bg-neutral-300"
                    : "bg-neutral-900 text-white hover:bg-neutral-800"
                }`}
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
                {showRoutePlanner ? "Cancel" : "Plan Route"}
              </button>
            )}
            <button
              onClick={handleToggleEmailPanel}
              className={`inline-flex items-center gap-2 px-4 py-2 text-xs uppercase tracking-wider transition-colors ${
                showEmailPanel
                  ? "bg-neutral-200 text-neutral-700 hover:bg-neutral-300"
                  : "bg-neutral-900 text-white hover:bg-neutral-800"
              }`}
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
                  d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"
                />
              </svg>
              {showEmailPanel ? "Cancel" : "Email Homes"}
            </button>
          </div>

          {showRoutePlanner && (
            <div className="mb-6 p-5 bg-neutral-50 border border-neutral-200">
              <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                <div className="flex-1">
                  <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1.5">
                    Starting Location
                  </label>
                  <input
                    type="text"
                    value={startingLocation}
                    onChange={(e) => setStartingLocation(e.target.value)}
                    placeholder="e.g. 123 Main St, San Jose, CA"
                    className="w-full px-3 py-2 border border-neutral-300 text-sm focus:outline-none focus:border-[#d4a012] transition-colors"
                  />
                  <p className="text-xs text-neutral-400 mt-1">
                    Leave blank to start from the first selected home
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-neutral-500 whitespace-nowrap">
                    {selectedIds.size} selected
                  </span>
                  <button
                    onClick={handleSelectAll}
                    className="text-xs uppercase tracking-wider text-[#d4a012] hover:text-[#b8890f] transition-colors whitespace-nowrap"
                  >
                    {homes.filter((h) => h.address).every((h) => selectedIds.has(h.id))
                      ? "Deselect All"
                      : "Select All"}
                  </button>
                  <button
                    onClick={handlePreviewRoute}
                    disabled={selectedIds.size === 0}
                    className="inline-flex items-center gap-2 bg-neutral-900 text-white px-4 py-2 text-xs uppercase tracking-wider hover:bg-neutral-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    Preview Route
                  </button>
                  <button
                    onClick={handleOpenRoute}
                    disabled={selectedIds.size === 0}
                    className="inline-flex items-center gap-2 bg-[#d4a012] text-white px-4 py-2 text-xs uppercase tracking-wider hover:bg-[#b8890f] transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    Open in Google Maps
                  </button>
                </div>
              </div>
              {previewUrl && (
                <div className="mt-4">
                  <iframe
                    src={previewUrl}
                    className="w-full border border-neutral-200"
                    style={{ height: "400px" }}
                    allowFullScreen
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>
              )}
            </div>
          )}

          {showEmailPanel && (
            <div className="mb-6 p-5 bg-neutral-50 border border-neutral-200">
              {emailSent ? (
                <div className="text-center py-4">
                  <svg className="w-10 h-10 text-green-500 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-neutral-900 font-medium mb-1">Email Sent!</p>
                  <p className="text-sm text-neutral-500">
                    {emailSelectedIds.size} home{emailSelectedIds.size === 1 ? "" : "s"} sent to {recipientEmail}
                  </p>
                  <button
                    onClick={() => setShowEmailPanel(false)}
                    className="mt-4 text-xs uppercase tracking-wider text-[#d4a012] hover:text-[#b8890f] transition-colors"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex-1">
                      <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1.5">
                        Recipient Email
                      </label>
                      <input
                        type="email"
                        value={recipientEmail}
                        onChange={(e) => {
                          setRecipientEmail(e.target.value);
                          setEmailError("");
                        }}
                        placeholder="e.g. buyer@example.com"
                        className="w-full px-3 py-2 border border-neutral-300 text-sm focus:outline-none focus:border-[#d4a012] transition-colors"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1.5">
                        Subject
                      </label>
                      <input
                        type="text"
                        value={emailSubject}
                        onChange={(e) => setEmailSubject(e.target.value)}
                        placeholder="Homes I'd like to share with you"
                        className="w-full px-3 py-2 border border-neutral-300 text-sm focus:outline-none focus:border-[#d4a012] transition-colors"
                      />
                    </div>
                  </div>
                  {emailError && (
                    <p className="text-xs text-red-500 -mt-2">{emailError}</p>
                  )}
                  <div className="flex items-center gap-3">
                    <span className="text-sm text-neutral-500 whitespace-nowrap">
                      {emailSelectedIds.size} selected
                    </span>
                    <button
                      onClick={handleEmailSelectAll}
                      className="text-xs uppercase tracking-wider text-[#d4a012] hover:text-[#b8890f] transition-colors whitespace-nowrap"
                    >
                      {homes.every((h) => emailSelectedIds.has(h.id))
                        ? "Deselect All"
                        : "Select All"}
                    </button>
                    <button
                      onClick={handleSendEmail}
                      disabled={emailSelectedIds.size === 0 || !recipientEmail.trim() || sendingEmail}
                      className="inline-flex items-center gap-2 bg-[#d4a012] text-white px-4 py-2 text-xs uppercase tracking-wider hover:bg-[#b8890f] transition-colors disabled:opacity-40 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                      {sendingEmail ? "Sending..." : "Send Email"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {homes.map((home) => (
              <SavedHomeCard
                key={home.id}
                home={home}
                onRemove={handleRemove}
                selectable={isSelectableMode}
                selected={activeSelectedIds.has(home.id)}
                onToggleSelect={activeToggleSelect}
                showComment={showEmailPanel && emailSelectedIds.has(home.id)}
                commentValue={emailComments.get(home.id) || ""}
                onCommentChange={handleCommentChange}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
