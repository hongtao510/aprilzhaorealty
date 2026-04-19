"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const clientLinks = [
  {
    href: "/portal",
    label: "Dashboard",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    href: "/portal/listings",
    label: "Browse Listings",
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9.5L12 3l9 6.5M5 10v10a1 1 0 001 1h4v-6h4v6h4a1 1 0 001-1V10" />
      </svg>
    ),
  },
];

export default function ClientSidebar() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === "/portal") return pathname === "/portal";
    return pathname.startsWith(href);
  };

  return (
    <aside className="w-64 border-r border-neutral-200 bg-neutral-50 min-h-[calc(100vh-4rem)] flex flex-col">
      <nav className="flex-1 py-6 px-4 space-y-1">
        {clientLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className={`flex items-center gap-3 px-4 py-3 text-sm uppercase tracking-wider transition-colors ${
              isActive(link.href)
                ? "text-[#d4a012] bg-white border border-neutral-200"
                : "text-neutral-500 hover:text-neutral-900 hover:bg-white"
            }`}
          >
            {link.icon}
            {link.label}
          </Link>
        ))}
      </nav>

      <div className="p-4 border-t border-neutral-200">
        <Link
          href="/"
          className="flex items-center gap-3 px-4 py-3 text-sm text-neutral-400 hover:text-neutral-900 transition-colors uppercase tracking-wider"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          Back to Site
        </Link>
      </div>
    </aside>
  );
}
