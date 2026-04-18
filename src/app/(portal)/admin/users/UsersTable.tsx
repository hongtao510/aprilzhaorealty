"use client";

import { useState } from "react";

export interface UserRow {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  role: string;
  newsletter_cities: string[];
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
      prev.map((r) => (r.id === id ? { ...r, newsletter_cities: [] } : r))
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
              <th className="text-left px-4 py-3">Joined</th>
              <th className="text-left px-4 py-3">Last sign-in</th>
              <th className="text-right px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-neutral-200 hover:bg-neutral-50/50">
                <td className="px-4 py-3 align-top">
                  <div className="flex flex-col">
                    <span className="text-neutral-900 font-medium">
                      {r.full_name || "—"}
                    </span>
                    <span className="text-neutral-500 text-xs">{r.email}</span>
                    {r.role === "admin" && (
                      <span className="mt-1 inline-block w-fit px-2 py-0.5 bg-[#d4a012] text-white text-[10px] uppercase tracking-wider">
                        Admin
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 align-top text-neutral-600">{r.phone || "—"}</td>
                <td className="px-4 py-3 align-top">
                  {r.newsletter_cities.length === 0 ? (
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
                <td className="px-4 py-3 align-top text-neutral-600">{fmtDate(r.created_at)}</td>
                <td className="px-4 py-3 align-top text-neutral-600">{fmtDate(r.last_sign_in_at)}</td>
                <td className="px-4 py-3 align-top text-right">
                  {r.newsletter_cities.length > 0 && (
                    <button
                      type="button"
                      onClick={() => clearNewsletter(r.id)}
                      disabled={busyId === r.id}
                      className="text-xs uppercase tracking-wider text-neutral-500 hover:text-red-600 transition-colors disabled:opacity-40"
                    >
                      {busyId === r.id ? "Clearing..." : "Clear newsletter"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-neutral-400 mt-3">
        Showing the {rows.length} most recent accounts.
      </p>
    </div>
  );
}
