"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface DashboardStats {
  clientCount: number;
  materialCount: number;
  unreadMessages: number;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats>({
    clientCount: 0,
    materialCount: 0,
    unreadMessages: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch("/api/admin/clients");
        if (res.ok) {
          const clients = await res.json();
          setStats({
            clientCount: clients.length,
            materialCount: clients.reduce(
              (sum: number, c: { material_count: number }) => sum + (c.material_count || 0),
              0
            ),
            unreadMessages: clients.reduce(
              (sum: number, c: { unread_count: number }) => sum + (c.unread_count || 0),
              0
            ),
          });
        }
      } catch {
        // fail silently
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  const cards = [
    {
      label: "Total Clients",
      value: stats.clientCount,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ),
      href: "/admin/clients",
    },
    {
      label: "Materials Shared",
      value: stats.materialCount,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
        </svg>
      ),
    },
    {
      label: "Unread Messages",
      value: stats.unreadMessages,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
      ),
    },
  ];

  return (
    <div>
      <div className="mb-8">
        <p className="text-[#d4a012] text-xs uppercase tracking-[0.3em] mb-2">
          Overview
        </p>
        <h1 className="font-serif text-3xl text-neutral-900">Dashboard</h1>
        <div className="w-16 h-0.5 bg-[#d4a012] mt-4" />
      </div>

      {loading ? (
        <p className="text-neutral-400 text-sm">Loading stats...</p>
      ) : (
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          {cards.map((card) => {
            const content = (
              <>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-neutral-400 group-hover:text-[#d4a012] transition-colors">
                    {card.icon}
                  </span>
                </div>
                <p className="font-serif text-3xl text-neutral-900 mb-1">
                  {card.value}
                </p>
                <p className="text-xs uppercase tracking-wider text-neutral-500">
                  {card.label}
                </p>
              </>
            );

            return card.href ? (
              <Link
                key={card.label}
                href={card.href}
                className="bg-neutral-50 border border-neutral-200 hover:border-[#d4a012] p-6 transition-colors group"
              >
                {content}
              </Link>
            ) : (
              <div
                key={card.label}
                className="bg-neutral-50 border border-neutral-200 hover:border-[#d4a012] p-6 transition-colors group"
              >
                {content}
              </div>
            );
          })}
        </div>
      )}

      <div className="flex gap-4">
        <Link
          href="/admin/clients/new"
          className="px-6 py-3 bg-[#d4a012] text-white text-xs font-medium uppercase tracking-[0.15em] hover:bg-[#b8890f] transition-colors"
        >
          Add New Client
        </Link>
        <Link
          href="/admin/clients"
          className="px-6 py-3 border border-neutral-200 text-neutral-600 text-xs font-medium uppercase tracking-[0.15em] hover:border-neutral-400 hover:text-neutral-900 transition-colors"
        >
          View All Clients
        </Link>
      </div>
    </div>
  );
}
