"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";

export default function ClientDashboard() {
  const { profile } = useAuth();
  const [materialCount, setMaterialCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [savedHomesCount, setSavedHomesCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      try {
        const [matRes, msgRes, homesRes] = await Promise.all([
          fetch("/api/portal/materials"),
          fetch("/api/portal/messages"),
          fetch("/api/portal/saved-homes"),
        ]);
        if (matRes.ok) {
          const mats = await matRes.json();
          setMaterialCount(mats.length);
        }
        if (msgRes.ok) {
          const msgs = await msgRes.json();
          setUnreadCount(
            msgs.filter(
              (m: { is_read: boolean; sender_id: string }) =>
                !m.is_read && m.sender_id !== profile?.id
            ).length
          );
        }
        if (homesRes.ok) {
          const homes = await homesRes.json();
          setSavedHomesCount(homes.length);
        }
      } catch {
        // fail silently
      } finally {
        setLoading(false);
      }
    }
    if (profile) fetchStats();
  }, [profile]);

  return (
    <div>
      <div className="mb-8">
        <p className="text-[#d4a012] text-xs uppercase tracking-[0.3em] mb-2">
          Welcome Back
        </p>
        <h1 className="font-serif text-3xl text-neutral-900">
          Hello, {profile?.full_name?.split(" ")[0] || "there"}
        </h1>
        <div className="w-16 h-0.5 bg-[#d4a012] mt-4" />
      </div>

      {loading ? (
        <p className="text-neutral-400 text-sm">Loading...</p>
      ) : (
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Link
            href="/portal/materials"
            className="bg-neutral-50 border border-neutral-200 hover:border-[#d4a012] p-6 transition-colors group"
          >
            <div className="flex items-center gap-3 mb-3">
              <svg
                className="w-6 h-6 text-neutral-400 group-hover:text-[#d4a012] transition-colors"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                />
              </svg>
            </div>
            <p className="font-serif text-3xl text-neutral-900 mb-1">
              {materialCount}
            </p>
            <p className="text-xs uppercase tracking-wider text-neutral-500">
              Materials Available
            </p>
          </Link>

          <Link
            href="/portal/messages"
            className="bg-neutral-50 border border-neutral-200 hover:border-[#d4a012] p-6 transition-colors group"
          >
            <div className="flex items-center gap-3 mb-3">
              <svg
                className="w-6 h-6 text-neutral-400 group-hover:text-[#d4a012] transition-colors"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                />
              </svg>
            </div>
            <p className="font-serif text-3xl text-neutral-900 mb-1">
              {unreadCount > 0 ? unreadCount : "0"}
            </p>
            <p className="text-xs uppercase tracking-wider text-neutral-500">
              {unreadCount > 0 ? "Unread Messages" : "Messages"}
            </p>
          </Link>

          <Link
            href="/portal/saved-homes"
            className="bg-neutral-50 border border-neutral-200 hover:border-[#d4a012] p-6 transition-colors group"
          >
            <div className="flex items-center gap-3 mb-3">
              <svg
                className="w-6 h-6 text-neutral-400 group-hover:text-[#d4a012] transition-colors"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                />
              </svg>
            </div>
            <p className="font-serif text-3xl text-neutral-900 mb-1">
              {savedHomesCount}
            </p>
            <p className="text-xs uppercase tracking-wider text-neutral-500">
              Saved Homes
            </p>
          </Link>
        </div>
      )}

      <p className="text-neutral-500 text-sm leading-relaxed max-w-lg">
        This is your personal portal for accessing housing materials and
        communicating with April. Browse your shared documents or send a message
        anytime.
      </p>
    </div>
  );
}
