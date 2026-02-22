"use client";

import { useState, useEffect, useCallback } from "react";
import type { CandidateHome, Profile } from "@/lib/types";
import CandidateHomeCard from "@/components/portal/CandidateHomeCard";

type TabFilter = "all" | "new" | "saved" | "dismissed";
type ActivePanel = null | "route" | "email";

/** Extract a clean street address from scraped listing text. */
function extractRouteAddress(raw: string): string {
  let cleaned = raw
    .replace(/[-–—]?\s*\d+\.?\d*\s*beds?\s*[/|,]\s*\d+\.?\d*\s*baths?.*/i, "")
    .replace(/[-–—]?\s*[\d,]+\s*sq\.?\s*ft\.?.*/i, "")
    .trim()
    .replace(/[-–—,\s]+$/, "")
    .trim();

  const match = cleaned.match(
    /(\d+\s[^,]+(?:,\s*[^,]+)*,\s*[A-Z]{2}\s+\d{5}(?:-\d{4})?)/
  );
  if (match) return match[1].trim();

  return cleaned;
}

export default function CandidatesPage() {
  const [candidates, setCandidates] = useState<CandidateHome[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabFilter>("new");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);

  // Add manually
  const [showAddModal, setShowAddModal] = useState(false);
  const [addUrl, setAddUrl] = useState("");
  const [adding, setAdding] = useState(false);

  // Route planner
  const [startingLocation, setStartingLocation] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  // Email / Send panel
  const [clients, setClients] = useState<(Profile & { full_name: string; email: string })[]>([]);
  const [emailMode, setEmailMode] = useState<"client" | "manual">("client");
  const [selectedClientId, setSelectedClientId] = useState("");
  const [manualEmail, setManualEmail] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailMessage, setEmailMessage] = useState("");
  const [saveToClient, setSaveToClient] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const fetchCandidates = useCallback(async () => {
    setLoading(true);
    try {
      const statusParam = activeTab === "all" ? "" : `?status=${activeTab}`;
      const res = await fetch(`/api/admin/candidate-homes${statusParam}`);
      if (res.ok) {
        const data = await res.json();
        setCandidates(data);
      }
    } catch (err) {
      console.error("Failed to fetch candidates:", err);
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    fetchCandidates();
  }, [fetchCandidates]);

  // Fetch clients for send panel
  useEffect(() => {
    fetch("/api/admin/clients")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setClients(data);
      })
      .catch(console.error);
  }, []);

  // --- Selection ---

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (activePanel === "route") {
      setSelectedIds(new Set(candidates.filter((c) => c.address).map((c) => c.id)));
    } else {
      setSelectedIds(new Set(candidates.map((c) => c.id)));
    }
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  // --- Status change ---

  const handleStatusChange = async (id: string, newStatus: "new" | "saved" | "dismissed") => {
    const res = await fetch("/api/admin/candidate-homes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: [id], status: newStatus }),
    });
    if (res.ok) {
      if (activeTab !== "all" && newStatus !== activeTab) {
        setCandidates((prev) => prev.filter((c) => c.id !== id));
        setSelectedIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      } else {
        setCandidates((prev) =>
          prev.map((c) => (c.id === id ? { ...c, status: newStatus } : c))
        );
      }
    }
  };

  // --- Add manually ---

  const handleAddManually = async () => {
    if (!addUrl.trim()) return;
    setAdding(true);
    try {
      const res = await fetch("/api/admin/candidate-homes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: addUrl.trim() }),
      });
      if (res.ok) {
        setAddUrl("");
        setShowAddModal(false);
        fetchCandidates();
      } else {
        const data = await res.json();
        alert(data.error || "Failed to add");
      }
    } catch {
      alert("Failed to add listing");
    } finally {
      setAdding(false);
    }
  };

  // --- Panel toggles ---

  function handleToggleRoute() {
    if (activePanel === "route") {
      setActivePanel(null);
      setSelectedIds(new Set());
      setPreviewUrl(null);
    } else {
      setActivePanel("route");
      setSelectedIds(new Set(candidates.filter((c) => c.address).map((c) => c.id)));
      setStartingLocation("");
      setPreviewUrl(null);
      setSendResult(null);
    }
  }

  function handleToggleEmail() {
    if (activePanel === "email") {
      setActivePanel(null);
      setSelectedIds(new Set());
    } else {
      setActivePanel("email");
      setSelectedIds(new Set(candidates.map((c) => c.id)));
      setEmailMode("client");
      setSelectedClientId("");
      setManualEmail("");
      setEmailSubject("");
      setEmailMessage("");
      setSaveToClient(true);
      setSendResult(null);
      setPreviewUrl(null);
    }
  }

  // --- Route planner ---

  function buildRouteAddresses() {
    const selected = candidates.filter(
      (c) => selectedIds.has(c.id) && c.address
    );
    if (selected.length === 0) return null;

    const addresses = selected.map((c) => extractRouteAddress(c.address!));
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
    window.open(`https://www.google.com/maps/dir/${waypoints}`, "_blank");
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

  // --- Send email ---

  const canSend =
    selectedIds.size > 0 &&
    (emailMode === "client" ? !!selectedClientId : !!manualEmail.trim());

  const handleSend = async () => {
    if (!canSend) return;
    setSending(true);
    setSendResult(null);
    try {
      const res = await fetch("/api/admin/candidate-homes/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateIds: Array.from(selectedIds),
          clientId: emailMode === "client" ? selectedClientId : undefined,
          recipientEmail: emailMode === "manual" ? manualEmail.trim() : undefined,
          subject: emailSubject || undefined,
          message: emailMessage || undefined,
          saveToClient: emailMode === "client" ? saveToClient : false,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setSendResult({ type: "success", message: `Sent ${data.sent} home${data.sent === 1 ? "" : "s"} successfully!` });
        setSelectedIds(new Set());
        setEmailSubject("");
        setEmailMessage("");
        fetchCandidates();
      } else {
        setSendResult({ type: "error", message: data.error || "Failed to send" });
      }
    } catch {
      setSendResult({ type: "error", message: "Failed to send email" });
    } finally {
      setSending(false);
    }
  };

  const tabs: { key: TabFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "new", label: "New" },
    { key: "saved", label: "Saved" },
    { key: "dismissed", label: "Dismissed" },
  ];

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-[#d4a012] text-xs uppercase tracking-[0.3em] mb-2">
            Listings Pipeline
          </p>
          <h1 className="font-serif text-3xl text-neutral-900">
            Candidate Homes
          </h1>
          <div className="w-16 h-0.5 bg-[#d4a012] mt-4" />
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleToggleRoute}
            className={`inline-flex items-center gap-2 px-4 py-3 text-xs uppercase tracking-wider transition-colors ${
              activePanel === "route"
                ? "bg-neutral-200 text-neutral-700 hover:bg-neutral-300"
                : "bg-neutral-900 text-white hover:bg-neutral-800"
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            {activePanel === "route" ? "Cancel" : "Plan Route"}
          </button>
          <button
            onClick={handleToggleEmail}
            className={`inline-flex items-center gap-2 px-4 py-3 text-xs uppercase tracking-wider transition-colors ${
              activePanel === "email"
                ? "bg-neutral-200 text-neutral-700 hover:bg-neutral-300"
                : "bg-neutral-900 text-white hover:bg-neutral-800"
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
            </svg>
            {activePanel === "email" ? "Cancel" : "Email Homes"}
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-3 bg-[#d4a012] text-white text-xs uppercase tracking-wider hover:bg-[#b8890f] transition-colors"
          >
            Add Manually
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 mb-6 border-b border-neutral-200">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => {
              setActiveTab(tab.key);
              setSelectedIds(new Set());
              setActivePanel(null);
              setPreviewUrl(null);
            }}
            className={`px-4 py-2 text-sm uppercase tracking-wider transition-colors border-b-2 -mb-px ${
              activeTab === tab.key
                ? "border-[#d4a012] text-[#d4a012]"
                : "border-transparent text-neutral-400 hover:text-neutral-600"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Count */}
      {!loading && candidates.length > 0 && (
        <p className="text-xs text-neutral-400 uppercase tracking-wider mb-4">
          {candidates.length} candidate{candidates.length !== 1 ? "s" : ""}
        </p>
      )}

      {/* Route planner panel */}
      {activePanel === "route" && (
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
                onClick={() => {
                  const addressableIds = candidates.filter((c) => c.address).map((c) => c.id);
                  const allSelected = addressableIds.every((id) => selectedIds.has(id));
                  setSelectedIds(allSelected ? new Set() : new Set(addressableIds));
                }}
                className="text-xs uppercase tracking-wider text-[#d4a012] hover:text-[#b8890f] transition-colors whitespace-nowrap"
              >
                {candidates.filter((c) => c.address).every((c) => selectedIds.has(c.id))
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

      {/* Email / Send panel */}
      {activePanel === "email" && (
        <div className="mb-6 p-5 border border-[#d4a012]/30 bg-[#faf8f0]">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium text-neutral-900">
              {selectedIds.size} home{selectedIds.size !== 1 ? "s" : ""} selected
            </p>
            <div className="flex gap-2">
              <button
                onClick={selectAll}
                className="text-xs uppercase tracking-wider text-[#d4a012] hover:text-[#b8890f] transition-colors"
              >
                Select All
              </button>
              <span className="text-neutral-300">|</span>
              <button
                onClick={deselectAll}
                className="text-xs uppercase tracking-wider text-neutral-400 hover:text-neutral-600 transition-colors"
              >
                Deselect All
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <label className="block text-xs uppercase tracking-wider text-neutral-500">
                  Send to
                </label>
                <div className="flex border border-neutral-200 rounded overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setEmailMode("client")}
                    className={`px-3 py-1 text-xs uppercase tracking-wider transition-colors ${
                      emailMode === "client"
                        ? "bg-[#d4a012] text-white"
                        : "bg-white text-neutral-500 hover:text-neutral-700"
                    }`}
                  >
                    Client
                  </button>
                  <button
                    type="button"
                    onClick={() => setEmailMode("manual")}
                    className={`px-3 py-1 text-xs uppercase tracking-wider transition-colors ${
                      emailMode === "manual"
                        ? "bg-[#d4a012] text-white"
                        : "bg-white text-neutral-500 hover:text-neutral-700"
                    }`}
                  >
                    Email
                  </button>
                </div>
              </div>
              {emailMode === "client" ? (
                <select
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  className="w-full px-3 py-2 border border-neutral-200 text-sm text-neutral-700 focus:outline-none focus:border-[#d4a012] transition-colors bg-white"
                >
                  <option value="">Select a client...</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.full_name} ({c.email})
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="email"
                  value={manualEmail}
                  onChange={(e) => setManualEmail(e.target.value)}
                  placeholder="recipient@example.com"
                  className="w-full px-3 py-2 border border-neutral-200 text-sm text-neutral-700 placeholder:text-neutral-300 focus:outline-none focus:border-[#d4a012] transition-colors"
                />
              )}
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1">
                Subject (optional)
              </label>
              <input
                type="text"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                placeholder="Homes picked for you"
                className="w-full px-3 py-2 border border-neutral-200 text-sm text-neutral-700 placeholder:text-neutral-300 focus:outline-none focus:border-[#d4a012] transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-1">
                Personal Message (optional)
              </label>
              <textarea
                value={emailMessage}
                onChange={(e) => setEmailMessage(e.target.value)}
                placeholder="Add a personal note..."
                rows={3}
                className="w-full px-3 py-2 border border-neutral-200 text-sm text-neutral-700 placeholder:text-neutral-300 focus:outline-none focus:border-[#d4a012] transition-colors resize-none"
              />
            </div>

            {emailMode === "client" && (
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={saveToClient}
                  onChange={(e) => setSaveToClient(e.target.checked)}
                  className="accent-[#d4a012]"
                />
                <span className="text-sm text-neutral-600">
                  Save to client&apos;s collection
                </span>
              </label>
            )}

            <button
              onClick={handleSend}
              disabled={sending || !canSend}
              className="px-6 py-3 bg-[#d4a012] text-white text-sm uppercase tracking-wider hover:bg-[#b8890f] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? "Sending..." : "Send Email"}
            </button>

            {sendResult && (
              <p className={`text-sm ${sendResult.type === "success" ? "text-emerald-600" : "text-red-500"}`}>
                {sendResult.message}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="text-center py-12">
          <p className="text-neutral-400 text-sm uppercase tracking-wider">Loading...</p>
        </div>
      ) : candidates.length === 0 ? (
        /* Empty state */
        <div className="text-center py-16 bg-neutral-50 border border-neutral-200">
          <svg className="w-12 h-12 text-neutral-300 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-neutral-500 font-serif text-lg mb-2">No candidates yet</p>
          <p className="text-neutral-400 text-sm max-w-md mx-auto">
            Candidates are populated daily by the automated listing pipeline, or you can add them manually using the button above.
          </p>
        </div>
      ) : (
        /* Grid */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {candidates.map((home) => (
            <CandidateHomeCard
              key={home.id}
              home={home}
              onStatusChange={handleStatusChange}
              selectable={activePanel !== null}
              selected={selectedIds.has(home.id)}
              onToggleSelect={toggleSelect}
            />
          ))}
        </div>
      )}

      {/* Add Manually Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md p-6">
            <h2 className="font-serif text-xl text-neutral-900 mb-4">Add Listing Manually</h2>
            <p className="text-sm text-neutral-500 mb-4">
              Paste a Redfin, Zillow, or any listing URL to add it as a candidate.
            </p>
            <input
              type="url"
              value={addUrl}
              onChange={(e) => setAddUrl(e.target.value)}
              placeholder="https://www.redfin.com/..."
              className="w-full px-3 py-2 border border-neutral-200 text-sm text-neutral-700 placeholder:text-neutral-300 focus:outline-none focus:border-[#d4a012] transition-colors mb-4"
              onKeyDown={(e) => e.key === "Enter" && handleAddManually()}
            />
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => { setShowAddModal(false); setAddUrl(""); }}
                className="px-4 py-2 text-sm uppercase tracking-wider text-neutral-500 hover:text-neutral-700 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleAddManually}
                disabled={adding || !addUrl.trim()}
                className="px-6 py-2 bg-[#d4a012] text-white text-sm uppercase tracking-wider hover:bg-[#b8890f] transition-colors disabled:opacity-50"
              >
                {adding ? "Adding..." : "Add"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
