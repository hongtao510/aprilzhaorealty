"use client";

import { useState } from "react";

export interface UserRow {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: string;
  newsletter_cities: string[];
  newsletter_approved: boolean;
  is_concierge: boolean;
  created_at: string;
  last_sign_in_at: string | null;
}

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function UsersTable({ rows: initialRows }: { rows: UserRow[] }) {
  const [rows, setRows] = useState(initialRows);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function setApproval(id: string, approved: boolean) {
    setBusyId(id);
    setError(null);
    const res = await fetch(`/api/admin/users/${id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ approved }),
    });
    if (!res.ok) {
      setError("Failed to update approval.");
      setBusyId(null);
      return;
    }
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, newsletter_approved: approved } : r))
    );
    setBusyId(null);
  }

  async function clearNewsletter(id: string) {
    if (!confirm("Clear this user's newsletter subscription?")) return;
    setBusyId(id);
    setError(null);
    const res = await fetch(`/api/admin/users/${id}/unsubscribe`, {
      method: "POST",
    });
    if (!res.ok) {
      setError("Failed to clear subscription.");
      setBusyId(null);
      return;
    }
    setRows((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, newsletter_cities: [], newsletter_approved: false } : r
      )
    );
    setBusyId(null);
  }

  if (rows.length === 0) {
    return <p className="text-neutral-500 text-sm">No users yet.</p>;
  }

  return (
    <div>
      {error && (
        <p className="mb-4 p-3 bg-red-50 border border-red-100 text-red-700 text-sm">
          {error}
        </p>
      )}
      <div className="overflow-x-auto border border-neutral-200">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-xs uppercase tracking-wider text-neutral-500">
            <tr>
              <th className="text-left px-4 py-3">User</th>
              <th className="text-left px-4 py-3">Phone</th>
              <th className="text-left px-4 py-3">Newsletter cities</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Joined</th>
              <th className="text-left px-4 py-3">Last sign-in</th>
              <th className="text-right px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const hasCities = r.newsletter_cities.length > 0;
              const isPending = hasCities && !r.newsletter_approved;
              return (
                <tr
                  key={r.id}
                  className={`border-t border-neutral-200 ${isPending ? "bg-[#fdf6e3]/40" : "hover:bg-neutral-50/50"}`}
                >
                  <td className="px-4 py-3 align-top">
                    <div className="flex flex-col">
                      <span className="text-neutral-900 font-medium">
                        {r.full_name || "—"}
                      </span>
                      <span className="text-neutral-500 text-xs">{r.email}</span>
                      <div className="flex gap-1 mt-1 flex-wrap">
                        {r.role === "admin" && (
                          <span className="inline-block w-fit px-2 py-0.5 bg-[#d4a012] text-white text-[10px] uppercase tracking-wider">
                            Admin
                          </span>
                        )}
                        {r.is_concierge && (
                          <span className="inline-block w-fit px-2 py-0.5 bg-blue-100 text-blue-800 text-[10px] uppercase tracking-wider">
                            Client
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 align-top text-neutral-600">{r.phone || "—"}</td>
                  <td className="px-4 py-3 align-top">
                    {!hasCities ? (
                      <span className="text-neutral-400">—</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {r.newsletter_cities.map((c) => (
                          <span
                            key={c}
                            className="px-2 py-0.5 bg-neutral-100 text-neutral-700 text-xs"
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top">
                    {!hasCities ? (
                      <span className="text-neutral-400 text-xs">—</span>
                    ) : isPending ? (
                      <span className="px-2 py-0.5 bg-[#d4a012] text-white text-[10px] uppercase tracking-wider">
                        Pending
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[10px] uppercase tracking-wider">
                        Approved
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top text-neutral-600">{fmtDate(r.created_at)}</td>
                  <td className="px-4 py-3 align-top text-neutral-600">{fmtDate(r.last_sign_in_at)}</td>
                  <td className="px-4 py-3 align-top text-right">
                    <div className="flex flex-col gap-2 items-end">
                      {hasCities && !r.newsletter_approved && (
                        <button
                          type="button"
                          onClick={() => setApproval(r.id, true)}
                          disabled={busyId === r.id}
                          className="text-xs uppercase tracking-wider text-white bg-[#d4a012] hover:bg-[#b8890f] px-3 py-1.5 transition-colors disabled:opacity-40"
                        >
                          {busyId === r.id ? "..." : "Approve"}
                        </button>
                      )}
                      {hasCities && r.newsletter_approved && (
                        <button
                          type="button"
                          onClick={() => setApproval(r.id, false)}
                          disabled={busyId === r.id}
                          className="text-xs uppercase tracking-wider text-neutral-500 hover:text-red-600 transition-colors disabled:opacity-40"
                        >
                          {busyId === r.id ? "..." : "Revoke"}
                        </button>
                      )}
                      {hasCities && (
                        <button
                          type="button"
                          onClick={() => clearNewsletter(r.id)}
                          disabled={busyId === r.id}
                          className="text-xs uppercase tracking-wider text-neutral-400 hover:text-red-600 transition-colors disabled:opacity-40"
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-neutral-400 mt-3">
        Showing the {rows.length} most recent accounts. Pending approvals appear at the top.
      </p>
    </div>
  );
}
