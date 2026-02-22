"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface ClientRow {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  material_count: number;
  message_count: number;
  unread_count: number;
  created_at: string;
}

export default function ClientListPage() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchClients() {
      try {
        const res = await fetch("/api/admin/clients");
        if (res.ok) {
          setClients(await res.json());
        }
      } catch {
        // fail silently
      } finally {
        setLoading(false);
      }
    }
    fetchClients();
  }, []);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="text-[#d4a012] text-xs uppercase tracking-[0.3em] mb-2">
            Management
          </p>
          <h1 className="font-serif text-3xl text-neutral-900">Clients</h1>
          <div className="w-16 h-0.5 bg-[#d4a012] mt-4" />
        </div>
        <Link
          href="/admin/clients/new"
          className="px-6 py-3 bg-[#d4a012] text-white text-xs font-medium uppercase tracking-[0.15em] hover:bg-[#b8890f] transition-colors"
        >
          Add Client
        </Link>
      </div>

      {loading ? (
        <p className="text-neutral-400 text-sm">Loading clients...</p>
      ) : clients.length === 0 ? (
        <div className="bg-neutral-50 border border-neutral-200 p-12 text-center">
          <p className="text-neutral-500 mb-4">No clients yet.</p>
          <Link
            href="/admin/clients/new"
            className="text-[#d4a012] text-sm uppercase tracking-wider hover:text-[#b8890f] transition-colors"
          >
            Add your first client
          </Link>
        </div>
      ) : (
        <div className="bg-neutral-50 border border-neutral-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-neutral-200">
                <th className="text-left text-xs uppercase tracking-wider text-neutral-500 px-6 py-4">
                  Name
                </th>
                <th className="text-left text-xs uppercase tracking-wider text-neutral-500 px-6 py-4">
                  Email
                </th>
                <th className="text-left text-xs uppercase tracking-wider text-neutral-500 px-6 py-4 hidden md:table-cell">
                  Materials
                </th>
                <th className="text-left text-xs uppercase tracking-wider text-neutral-500 px-6 py-4 hidden md:table-cell">
                  Messages
                </th>
                <th className="text-left text-xs uppercase tracking-wider text-neutral-500 px-6 py-4 hidden lg:table-cell">
                  Joined
                </th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr
                  key={client.id}
                  className="border-b border-neutral-100 hover:bg-white transition-colors"
                >
                  <td className="px-6 py-4">
                    <Link
                      href={`/admin/clients/${client.id}`}
                      className="text-neutral-900 hover:text-[#d4a012] transition-colors font-medium"
                    >
                      {client.full_name}
                    </Link>
                  </td>
                  <td className="px-6 py-4 text-sm text-neutral-500">
                    {client.email}
                  </td>
                  <td className="px-6 py-4 text-sm text-neutral-500 hidden md:table-cell">
                    {client.material_count}
                  </td>
                  <td className="px-6 py-4 text-sm text-neutral-500 hidden md:table-cell">
                    {client.message_count}
                    {client.unread_count > 0 && (
                      <span className="ml-2 px-2 py-0.5 bg-[#d4a012] text-white text-xs">
                        {client.unread_count} new
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-neutral-400 hidden lg:table-cell">
                    {new Date(client.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
