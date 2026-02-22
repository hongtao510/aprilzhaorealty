"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function NewClientPage() {
  const [formData, setFormData] = useState({
    full_name: "",
    email: "",
    phone: "",
    password: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/admin/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create client");
      }

      const client = await res.json();
      router.push(`/admin/clients/${client.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg">
      <div className="mb-8">
        <Link
          href="/admin/clients"
          className="text-neutral-400 text-sm hover:text-neutral-900 transition-colors uppercase tracking-wider"
        >
          &larr; Back to Clients
        </Link>
      </div>

      <div className="mb-8">
        <p className="text-[#d4a012] text-xs uppercase tracking-[0.3em] mb-2">
          New Account
        </p>
        <h1 className="font-serif text-3xl text-neutral-900">Add Client</h1>
        <div className="w-16 h-0.5 bg-[#d4a012] mt-4" />
      </div>

      <div className="bg-neutral-50 p-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-700">
            <p className="text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-3">
              Full Name <span className="text-[#d4a012]">*</span>
            </label>
            <input
              type="text"
              value={formData.full_name}
              onChange={(e) =>
                setFormData({ ...formData, full_name: e.target.value })
              }
              className="w-full px-0 py-3 bg-transparent border-0 border-b-2 border-neutral-200 text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-[#d4a012] transition-colors"
              placeholder="Client's full name"
              required
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-3">
              Email <span className="text-[#d4a012]">*</span>
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              className="w-full px-0 py-3 bg-transparent border-0 border-b-2 border-neutral-200 text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-[#d4a012] transition-colors"
              placeholder="client@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-3">
              Phone <span className="text-neutral-400 normal-case">(optional)</span>
            </label>
            <input
              type="tel"
              value={formData.phone}
              onChange={(e) =>
                setFormData({ ...formData, phone: e.target.value })
              }
              className="w-full px-0 py-3 bg-transparent border-0 border-b-2 border-neutral-200 text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-[#d4a012] transition-colors"
              placeholder="(555) 123-4567"
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-wider text-neutral-500 mb-3">
              Temporary Password <span className="text-[#d4a012]">*</span>
            </label>
            <input
              type="text"
              value={formData.password}
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
              className="w-full px-0 py-3 bg-transparent border-0 border-b-2 border-neutral-200 text-neutral-900 placeholder-neutral-400 focus:outline-none focus:border-[#d4a012] transition-colors"
              placeholder="Temporary password for the client"
              required
              minLength={6}
            />
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={loading}
              className="px-12 py-4 bg-[#d4a012] text-white text-xs font-medium uppercase tracking-[0.15em] hover:bg-[#b8890f] transition-all duration-300 disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create Client"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
