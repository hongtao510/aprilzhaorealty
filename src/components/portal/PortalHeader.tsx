"use client";

import Link from "next/link";
import { useAuth } from "@/components/auth/AuthProvider";

export default function PortalHeader() {
  const { profile, signOut } = useAuth();

  return (
    <header className="h-16 border-b border-neutral-200 bg-white flex items-center px-6 justify-between">
      <Link href="/" className="flex flex-col group">
        <div className="font-serif text-xl font-normal tracking-wide text-neutral-900">
          <span className="text-[#d4a012]">April</span> Zhao
        </div>
        <span className="text-[9px] text-[#d4a012] tracking-[0.12em] uppercase">
          {profile?.role === "admin" ? "Admin Portal" : "Client Portal"}
        </span>
      </Link>

      <div className="flex items-center gap-4">
        {profile?.role === "admin" && (
          <nav className="hidden sm:flex items-center gap-1 mr-2">
            <Link
              href="/admin"
              className="px-3 py-1.5 text-xs uppercase tracking-wider text-neutral-500 hover:text-[#d4a012] transition-colors"
            >
              Admin
            </Link>
          </nav>
        )}
        <span className="text-sm text-neutral-500 hidden sm:block">
          {profile?.full_name || profile?.email}
        </span>
        <button
          onClick={signOut}
          className="px-4 py-2 text-xs uppercase tracking-wider text-neutral-500 hover:text-neutral-900 border border-neutral-200 hover:border-neutral-400 transition-colors"
        >
          Sign Out
        </button>
      </div>
    </header>
  );
}
